function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

const CROSS_ICON =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'

interface PageOptions {
  variant: 'success' | 'error'
  title: string
  message: string
}

function page({ variant, title, message }: PageOptions): string {
  const icon = variant === 'success' ? CHECK_ICON : CROSS_ICON

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(title)} · Cirrux</title>
    <style>
      :root {
        --bg: #f6f6f6;
        --card: #ffffff;
        --border: #e2e2e2;
        --title: #1a1a1a;
        --text: #5f6063;
        --badge-bg: #e6f0f7;
        --badge-fg: #0069af;
        --link: #0069af;
        --shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.06);
      }
      .badge--error {
        --badge-bg: #fdecec;
        --badge-fg: #ef4444;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f0f0f;
          --card: #1a1a1a;
          --border: #2a2a2a;
          --title: #f0f0f0;
          --text: #a0a0a0;
          --badge-bg: #11293a;
          --badge-fg: #66a5cf;
          --link: #66a5cf;
          --shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .badge--error {
          --badge-bg: #3a1717;
          --badge-fg: #f87171;
        }
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        height: 100%;
        margin: 0;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        background-color: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
          Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        -webkit-font-smoothing: antialiased;
        line-height: 1.5;
      }
      .card {
        width: 100%;
        max-width: 420px;
        padding: 40px;
        text-align: center;
        background-color: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        margin: 0 auto 20px;
        border-radius: 50%;
        background-color: var(--badge-bg);
        color: var(--badge-fg);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--title);
      }
      p {
        margin: 0;
        font-size: 15px;
        color: var(--text);
      }
      .link {
        display: inline-block;
        margin-top: 20px;
        font-size: 14px;
        font-weight: 500;
        color: var(--link);
        text-decoration: none;
      }
      .link:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge${variant === 'error' ? ' badge--error' : ''}">${icon}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="link" href="https://cirrux.co/help/cli" target="_blank" rel="noopener noreferrer">Learn what you can do with the CLI →</a>
    </main>
  </body>
</html>`
}

export function renderSuccessPage(): string {
  return page({
    variant: 'success',
    title: 'Login successful',
    message: 'You’re signed in to the Cirrux CLI. You can close this tab and return to your terminal.',
  })
}

export function renderErrorPage(message: string): string {
  return page({
    variant: 'error',
    title: 'Login failed',
    message,
  })
}
