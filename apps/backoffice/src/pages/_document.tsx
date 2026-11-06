import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="tr">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#6650CD" />
        <link rel="icon" type="image/png" sizes="48x48" href="/brand/icon-48.png?v=mint1" />
        <link rel="apple-touch-icon" sizes="180x180" href="/brand/icon-180.png?v=mint1" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
