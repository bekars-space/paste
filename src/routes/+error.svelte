<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>{page.status} · paste</title>
</svelte:head>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>
    {page.status === 404
      ? "This paste does not exist — or it has expired."
      : (page.error?.message ?? "Something went wrong.")}
  </p>
  <a href="/">new paste</a>
</div>
