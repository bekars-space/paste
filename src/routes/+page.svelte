<script lang="ts">
  import type { PageProps } from "./$types";
  import { enhance } from "$app/forms";
  import { DEFAULT_TTL, TTL_CHOICES } from "$lib/ttl";
  import { formatBytes } from "$lib/format";

  let { form }: PageProps = $props();

  let content = $state("");
  let ttl = $state<string>(DEFAULT_TTL);
  let submitting = $state(false);

  // Client-side guard only — the server enforces its configured PASTE_MAX_BYTES.
  const MAX_BYTES = 5_242_880;

  const encoder = new TextEncoder();
  const size = $derived(encoder.encode(content).length);
  const tooBig = $derived(size > MAX_BYTES);

  function onSubmit() {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      submitting = false;
    };
  }
</script>

<svelte:head>
  <title>paste</title>
</svelte:head>

<div class="page-head">
  <div>
    <h1>New paste</h1>
    <p class="lede">Anonymous text sharing with automatic expiry.</p>
  </div>
</div>

<form method="POST" use:enhance={onSubmit}>
  <textarea
    name="content"
    bind:value={content}
    placeholder="Paste text here…"
    spellcheck="false"
    aria-label="Paste content"></textarea>

  <div class="toolbar">
    <div class="field">
      <label class="micro" for="ttl">Expiry</label>
      <select id="ttl" name="ttl" aria-label="Expiry">
        {#each TTL_CHOICES as choice (choice)}
          <option value={choice} selected={choice === ttl}>{choice}</option>
        {/each}
      </select>
    </div>

    <span class="size-indicator" class:over={tooBig}>
      {formatBytes(size)}{tooBig ? " — over limit" : ""}
    </span>

    <button class="btn btn-primary" disabled={submitting || tooBig}>
      {submitting ? "Creating…" : "Create paste"}
    </button>
  </div>

  {#if form?.message}
    <p class="flash">{form.message}</p>
  {/if}
</form>
