<script lang="ts">
  import type { PageProps } from "./$types";
  import { formatBytes, formatUtc } from "$lib/format";

  let { data }: PageProps = $props();

  let copied = $state(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(data.content);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<svelte:head>
  <title>paste · {data.id}</title>
</svelte:head>

<div class="meta">
  <span>{data.id}</span>
  <span>{formatBytes(data.sizeBytes)}</span>
  <span>created {formatUtc(data.createdAt)}</span>
  <span>expires {formatUtc(data.expiresAt)}</span>
  <a href={`/raw/${data.id}`}>raw</a>
  <button class="linkish" onclick={copy}>{copied ? "copied ✓" : "copy"}</button>
</div>

<pre class="paste"><code>{data.content}</code></pre>
