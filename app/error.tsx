'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Let’s try that again.</h1>
      <p>Your saved pets are still on this device.</p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
