# ローカル実行型文字起こしツール

ローカルの動画・音声ファイルを読み込み、OpenAI APIを利用して音声をテキスト化する最小構成のWebツールです。生成された文章を文単位で表示し、各文をクリックすると、選択した表示・解説言語で意味・文法・単語解説を確認できます。

## Features

- 音声・動画ファイルの選択
- OpenAI APIによる文字起こし
- 文単位の文章リスト表示
- 英語・日本語・中国語の音声言語選択
- 表示言語とAI解説言語の切り替え
- サンプル文章でUI確認

## Tech Stack

- HTML
- CSS
- JavaScript
- Node.js
- OpenAI API

## Setup

```bash
cp .env.example .env
```

`.env` に OpenAI API Key を設定します。

```env
# OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_KEY=
PORT=3000
```

起動します。

```bash
npm start
```

WindowsでNode.jsのパスが通っていない場合は、次のスクリプトでも起動できます。

```powershell
.\start-local.ps1
```

ブラウザで開きます。

```text
http://localhost:3000
```

## Notes

この最小版はタイムスタンプ付き字幕や動画との同期表示には対応していません。音声全体を文字起こしし、文単位で語学学習用の解説を表示する構成です。

動画ファイルはブラウザからローカルのNode.jsサーバーへ送られ、OpenAI APIへ転送されます。オンライン公開する場合は、ファイルサイズ制限や保存ポリシーを追加してください。
