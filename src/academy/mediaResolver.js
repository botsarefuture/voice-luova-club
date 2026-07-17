const MEDIA_BLOCK_TYPES = new Set(["image", "audio", "video"]);

export function resolveLessonMedia(lesson, manifest) {
  if (!lesson?.blocks || !Array.isArray(manifest?.assets)) return lesson;
  const assets = new Map(manifest.assets.filter(isUsableAsset).map((asset) => [assetKey(asset), asset]));
  let changed = false;
  const blocks = lesson.blocks.map((block) => {
    const reference = block.content?.assetRef;
    if (!MEDIA_BLOCK_TYPES.has(block.type) || !reference) return block;
    const asset = assets.get(assetKey(reference));
    if (!asset || asset.kind !== block.type) return block;
    changed = true;
    return {
      ...block,
      content: { ...block.content, src: asset.source },
      accessibility: { ...block.accessibility, ...assetAccessibility(asset) },
    };
  });
  return changed ? { ...lesson, blocks } : lesson;
}

function isUsableAsset(asset) {
  return asset && typeof asset.id === "string" && Number.isInteger(asset.version) && typeof asset.locale === "string" && typeof asset.source === "string" && ["image", "audio", "video", "document"].includes(asset.kind) && ["content_checked", "research_checked", "accessibility_checked"].every((key) => asset.review?.[key] === true);
}

function assetKey(asset) {
  return `${asset.id}:${asset.version}:${asset.locale}`;
}

function assetAccessibility(asset) {
  if (asset.kind === "image") return { alternative: asset.accessibility?.alternative ?? null };
  if (asset.kind === "audio") return { transcript: asset.accessibility?.transcript ?? null };
  if (asset.kind === "video") return { transcript: asset.accessibility?.transcript ?? null, captions: asset.accessibility?.captions ?? null };
  return {};
}
