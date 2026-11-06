import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return <html lang="tr" {...htmlAttributes}><head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#6650CD" />
    <link rel="icon" type="image/png" sizes="48x48" href="/brand/icon-48.png?v=mint1" />
    <link rel="apple-touch-icon" sizes="180x180" href="/brand/icon-180.png?v=mint1" />
    <link rel="manifest" href="/site.webmanifest" />
    <ScrollViewStyleReset />
    {headNodes}
  </head><body {...bodyAttributes}>{children}{bodyNodes}</body></html>;
}
