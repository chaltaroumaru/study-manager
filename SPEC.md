# 勉強状況管理アプリ プロトタイプ 仕様(共通契約) v2

個人成果物。教育機関(塾・大学等)向けにカスタマイズ性を高め、かつ「先生が生徒の学習記録を見られる」
「生徒は担当教員を選ぶだけで同期完了」という要件を満たすため、v1のlocalStorageのみの構成から
**Firebase(Firestore + Anonymous Auth)を使う構成に変更した**。フロントはHTML/CSS/JSのみ、
ビルド不要(ESモジュールをCDNから読み込む)。GitHub Pagesで静的ホスティングする想定。

## なぜFirebaseか
- localStorageはブラウザ単体にしか保存されないため、先生と生徒が別々の端末を使う場合は同期できない。
- Firestoreを使えば、生徒が保存したデータを先生が別端末からリアルタイムに読める。
- 無料枠(Sparkプラン)の範囲で個人プロトタイプには十分。
- パスワードなしのポリシーは維持したいので、**Firebase Anonymous Authentication**(匿名ログイン)を
  裏側で自動的に使う。ユーザー体験は「名前を選ぶだけ」のまま変わらない。

## セキュリティに関する注意(重要・ユーザーに伝えること)
- Firestoreのルールは「ログイン(匿名含む)していれば誰でも読み書き可」という緩いルールにしている
  (名前ベースの疑似ログインのため、Firebase Authの本人確認とは紐付いていない)。
  → **本物の個人情報を入れない、公開デモ用途と割り切る**のがこのプロトタイプの前提。
  本格運用する場合は、名前ではなくメール等による本人認証への切り替えが必要。

## ファイル構成

```
study-tracker-app/
  index.html            … ユーザー選択(疑似ログイン)+ 新規時は役割(先生/生徒)選択、
                           生徒は担当教員の選択も行う。エントリーポイント
  record.html            … 学習記録+日次ジャーナルの入力・閲覧画面(1日1エントリー)
  calendar.html          … カレンダー表示。日付をクリックするとその日のrecord.htmlへ
  settings.html          … 科目のカスタマイズ・目標時間・担当教員の変更
  teacher.html           … 先生用。担当生徒一覧 → 生徒を選ぶとその生徒のカレンダーを閲覧
  css/style.css          … 共通スタイル(既存クラスを流用。新規CSSファイルは作らない)
  js/firebase-config.js  … Firebaseプロジェクトの接続情報(ユーザーが自分のプロジェクトの値を入れる)
  js/data.js             … 共通データ層(Firestore経由)。ESモジュール。スキーマ変更禁止
```

## データモデル(Firestore)

```
users/{name}                      … name は疑似ログイン名をそのままドキュメントIDに使う
  role: "teacher" | "student" | null
  teacherName: string | null       … 生徒のみ。選んだ担当教員の名前
  subjects: string[]               … 科目リスト(カスタマイズ可能)
  goal: { dailyMinutes: number }
  createdAt: number

users/{name}/entries/{date}       … date は "YYYY-MM-DD"。1日1ドキュメント
  date: string
  records: { subject: string, minutes: number }[]   … その日の学習時間ログ(複数科目分)
  studiedContent: string           … その日学習した内容
  issues: string                   … 見つかった課題・わからなかったポイント
  question: string                 … 先生への質問
  other: string                    … その他
```

## データ層 (js/data.js, `StudyData`) — 全て非同期(Promiseを返す)

全画面は必ずこのAPI経由でFirestoreを読み書きする。`db`や`firebase`に直接アクセスしない。
どのページも `<script type="module">` で `import { StudyData } from './js/data.js'` し、
使う前に必ず `await StudyData.ready` を待つこと(匿名ログイン完了を待つため)。

- `StudyData.ready` — Promise。匿名ログイン完了で解決
- `StudyData.loginAs(name)` — 疑似ログイン。存在しないnameなら新規作成(role:null)
- `StudyData.getCurrentUser()` / `logout()` — 現在ログイン中の名前はlocalStorageに保持(Firestoreではない。UIの「今どのユーザーか」を覚えておくためだけ)
- `StudyData.setRole(name, role)` — "teacher" | "student" をセット
- `StudyData.getUserData(name)` — ユーザードキュメントを取得
- `StudyData.listTeachers()` — role:"teacher" の全ユーザー名一覧
- `StudyData.setTeacher(studentName, teacherName)` — 生徒の担当教員を設定(=同期)
- `StudyData.listStudentsOf(teacherName)` — teacherName に紐づく生徒名一覧
- `StudyData.getSubjects/setSubjects/addSubject/removeSubject(name, ...)`
- `StudyData.getGoal/setGoal(name, minutes)`
- `StudyData.getEntry(name, date)` → その日のエントリー(なければ空の初期値を返す。保存はされない)
- `StudyData.saveEntry(name, date, partial)` → 部分更新でその日のエントリーを保存
- `StudyData.addRecordToEntry(name, date, {subject, minutes})` → その日の学習時間ログに1件追加
- `StudyData.listEntryDates(name)` → エントリーが存在する日付一覧(新しい順)
- `StudyData.getAllEntries(name)` → 全エントリー配列
- `StudyData.getTotalMinutes(entries)` / `getMinutesByDate(entries)` / `calcStreak(entries)` — 集計ユーティリティ(引数は`getAllEntries`の結果)
- `StudyData.todayStr()` → "YYYY-MM-DD"

## 共通ヘッダー/ナビゲーション

生徒ログイン時:
```html
<header class="app-header">
  <div class="app-title">勉強状況管理アプリ</div>
  <nav class="app-nav">
    <a href="calendar.html">カレンダー</a>
    <a href="record.html">記録する</a>
    <a href="settings.html">設定</a>
  </nav>
  <div class="app-user">
    <span id="currentUserName"></span>
    <a href="#" id="logoutLink">ログアウト</a>
  </div>
</header>
```
先生ログイン時は `記録する` の代わりに `担当生徒` (teacher.html) を表示する。該当リンクに`class="active"`を付ける。

各ページ先頭のモジュールスクリプトの雛形:
```js
import { StudyData } from './js/data.js';
await StudyData.ready;
const currentUser = StudyData.getCurrentUser();
if (!currentUser) { window.location.href = 'index.html'; }
const userData = await StudyData.getUserData(currentUser);
document.getElementById('currentUserName').textContent = currentUser;
document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  StudyData.logout();
  window.location.href = 'index.html';
});
```

## 各画面の役割

- **index.html**: ユーザー名選択/作成 → 新規作成時のみ役割(先生/生徒)を選ばせる →
  生徒なら続けて `listTeachers()` から担当教員を選ばせる(あとで設定画面でも変更可)。
  役割に応じて生徒は`record.html`、先生は`teacher.html`へ遷移。
- **record.html**: URLクエリ `?date=YYYY-MM-DD`(省略時は今日)。`?student=NAME&readonly=1` が付いている場合は
  先生が生徒を閲覧するモード(保存不可・表示のみ)。表示/入力項目: 科目+分数の追加(複数可)、
  「今日学習した内容」「見つかった課題・わからなかったポイント」「先生への質問」「その他」の4つのテキスト欄。
- **calendar.html**: 月表示カレンダー。`?student=NAME` があれば先生が生徒のカレンダーを見るモード(readonly)。
  記録がある日は目印を付け、日付クリックで `record.html?date=...`(生徒閲覧時は`&student=NAME&readonly=1`も付与)へ。
  合計時間・連続日数のサマリーもここに表示してよい(旧dashboard.htmlの内容を統合)。
- **settings.html**: 科目のカスタマイズ・目標時間に加え、生徒のみ「担当教員の変更」欄(`listTeachers`/`setTeacher`)を追加。
- **teacher.html**: 先生のみアクセス。`listStudentsOf(currentUser)` で担当生徒一覧を表示し、
  クリックすると `calendar.html?student=NAME` に遷移して閲覧する。

## 進め方のメモ
- 見た目の磨き込みは後回し。既存CSSクラスの範囲で実装する。
- vanilla JS + ESモジュールのみ。Firebase以外の外部ライブラリ・ビルドツールは使わない。
