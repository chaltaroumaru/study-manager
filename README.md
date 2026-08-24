# 勉強状況管理アプリ

生徒が日々の学習内容を記録し、担当の先生がそれを閲覧できる学習管理アプリのプロトタイプです。
塾や大学など、教育機関で幅広く使えるようカスタマイズ性(科目・目標時間の変更)を重視しています。

## できること

- 名前を選ぶだけの簡易ログイン(パスワードなし)。初回のみ「先生」か「生徒」を選択
- 生徒は担当の先生を選ぶだけでデータが同期され、先生はその生徒の記録を閲覧できる
- 学習時間ログ(科目+分数)をカレンダーの日付ごとに記録
- 「今日学習した内容」「見つかった課題・わからなかったポイント」「先生への質問」「その他」を日ごとに記入
- カレンダーから見たい日をクリックしてその日の記録を見返せる
- 科目リスト・1日の目標時間は設定画面から自由にカスタマイズ可能

## 技術構成

- HTML / CSS / JavaScript のみ(ビルド不要、ESモジュールをCDNから読み込み)
- データは [Firebase](https://firebase.google.com/)(Firestore + Anonymous Authentication)に保存
  - 先生・生徒が別々の端末を使っても記録が同期されるようにするため
  - パスワードなしのログイン体験を保つため、裏側でFirebaseの匿名認証を使用

## セットアップ(このリポジトリを動かす場合)

1. [Firebaseコンソール](https://console.firebase.google.com/)でプロジェクトを新規作成(無料のSparkプランでOK)
2. 「Firestore Database」を有効化(本番環境モードでよい。リージョンは任意、迷ったら `asia-northeast1`)
3. 「Authentication」→「Sign-in method」で「匿名」を有効化
4. 「プロジェクトの設定」→「マイアプリ」→ウェブアプリを追加し、表示された `firebaseConfig` の値を
   [`js/firebase-config.js`](js/firebase-config.js) に貼り付ける
5. Firestoreの「ルール」タブに以下を設定する:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null;
         match /entries/{entryId} {
           allow read, write: if request.auth != null;
         }
       }
     }
   }
   ```

6. ローカルで確認する場合はプロジェクトフォルダで `python -m http.server 5500` を実行し、
   `http://localhost:5500` を開く(`file://` で直接開くとESモジュールが動かないブラウザがあるため)

## 注意(セキュリティについて)

このプロトタイプは「名前を選ぶだけ」の疑似ログインのため、Firestoreのルールは
「ログイン(匿名含む)していれば誰でも読み書き可能」という緩い設定にしています。
本物の個人情報を入力しない、デモ・ポートフォリオ用途と割り切った作りです。
本格運用する場合は、名前ではなくメールアドレス等による本人認証への切り替えが必要です。
