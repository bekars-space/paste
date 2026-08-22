<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
  <header>
    <a href="/">~/paste</a>
    <span class="meta">anonymous · ephemeral</span>
  </header>

  {@render children()}

  <footer>
    create from your terminal:
    <code>echo hi | curl --data-binary @- https://your-host/api/pastes</code>
  </footer>
</div>
