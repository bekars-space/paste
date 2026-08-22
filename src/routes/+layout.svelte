<script lang="ts">
  import "../app.css";
  import "@fontsource-variable/inter";
  import "@fontsource-variable/jetbrains-mono";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();

  type Theme = "light" | "dark";

  let theme = $state<Theme>("light");

  $effect(() => {
    theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });

  function toggleTheme(): void {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
  <header>
    <a class="wordmark" href="/"><span class="tilde">~/</span>paste</a>
    <div class="header-actions">
      <span class="tagline">anonymous · ephemeral</span>
      <button
        class="theme-toggle"
        onclick={toggleTheme}
        aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} theme"
      >
        {theme === "dark" ? "light" : "dark"}
      </button>
    </div>
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <span class="micro">create from your terminal</span>
    <code>echo hi | curl --data-binary @- https://your-host/api/pastes</code>
  </footer>
</div>
