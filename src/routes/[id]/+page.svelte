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

<div class="page-head">
  <div>
    <span class="micro">paste</span>
    <h1 class="paste-id">{data.id}</h1>
  </div>
  <div class="actions">
    <a class="btn btn-ghost" href={`/raw/${data.id}`}>Raw</a>
    <button class="btn btn-primary" onclick={copy}>
      {copied ? "Copied ✓" : "Copy"}
    </button>
  </div>
</div>

<dl class="meta-strip">
  <div>
    <dt>Size</dt>
    <dd>{formatBytes(data.sizeBytes)}</dd>
  </div>
  <div>
    <dt>Created</dt>
    <dd>{formatUtc(data.createdAt)}</dd>
  </div>
  <div>
    <dt>Expires</dt>
    <dd>{formatUtc(data.expiresAt)}</dd>
  </div>
</dl>

<pre class="paste"><code>{data.content}</code></pre>
