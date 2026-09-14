import type { ResourceLoader, ResourceOption } from "@/extensions";

const IMAGES: ResourceOption[] = [
  {
    id: "nginx:latest",
    label: "NGINX",
    description: "Web server",
    tone: "from-emerald-400 to-emerald-600",
  },
  {
    id: "postgres:16",
    label: "PostgreSQL",
    description: "Relational database",
    tone: "from-sky-400 to-blue-600",
  },
  {
    id: "redis:7",
    label: "Redis",
    description: "In-memory cache",
    tone: "from-rose-400 to-red-600",
  },
  {
    id: "node:22",
    label: "Node.js",
    description: "JavaScript runtime",
    tone: "from-lime-400 to-green-600",
  },
  {
    id: "python:3.12",
    label: "Python",
    description: "Python runtime",
    tone: "from-amber-400 to-orange-600",
  },
  {
    id: "busybox:1.36",
    label: "BusyBox",
    description: "Minimal utilities",
    tone: "from-zinc-400 to-zinc-600",
  },
];

const FLAVORS = [
  {
    id: "cpu-2c4g",
    label: "2 vCPU / 4 GiB",
    description: "General purpose",
    kind: "cpu",
    tone: "from-sky-400 to-blue-600",
  },
  {
    id: "cpu-4c8g",
    label: "4 vCPU / 8 GiB",
    description: "General purpose",
    kind: "cpu",
    tone: "from-sky-400 to-blue-600",
  },
  {
    id: "gpu-1xa100",
    label: "1x A100 40GB",
    description: "GPU accelerated",
    kind: "gpu",
    tone: "from-violet-400 to-purple-600",
  },
];

const MODELS: ResourceOption[] = [
  { id: "llama-3-8b", label: "Llama 3 8B", description: "General text" },
  { id: "qwen2.5-7b", label: "Qwen2.5 7B", description: "General text" },
  { id: "bge-m3", label: "BGE-M3", description: "Embeddings" },
];

/**
 * Playground-owned mock resource loader. A real app would fetch these from its
 * own APIs. Returns a Promise to mirror async loading.
 */
export const mockResourceLoader: ResourceLoader = ({ resource, type }) => {
  switch (resource) {
    case "image":
      return IMAGES;
    case "model":
      return MODELS;
    case "flavor": {
      const kinds = type
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const list =
        kinds && kinds.length > 0
          ? FLAVORS.filter((flavor) => kinds.includes(flavor.kind))
          : FLAVORS;
      return list.map(({ kind: _kind, ...option }) => option);
    }
    default:
      return [];
  }
};
