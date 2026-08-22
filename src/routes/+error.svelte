<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>{page.status} · paste</title>
</svelte:head>

<div class="error-page">
  <span class="error-code">{page.status}</span>
  <p>
    {page.status === 404
      ? "This paste does not exist — or it has expired."
      : (page.error?.message ?? "Something went wrong.")}
  </p>
  <a class="btn btn-ghost" href="/">New paste</a>
</div>
