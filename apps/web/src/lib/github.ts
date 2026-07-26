import { type PortfolioProject, projects } from "~/lib/blog-data";

type GitHubRepository = {
  description: string | null;
  homepage: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
};

export type SyncedProject = PortfolioProject & {
  github?: { language: string | null; stars: number; updatedAt: string };
};

function repositoryPath(url: string) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/?$/);
  return match?.[1];
}

async function enrichProject(
  project: PortfolioProject,
): Promise<SyncedProject> {
  const path = repositoryPath(project.repository);
  if (!path) return project;
  try {
    const response = await fetch(`https://api.github.com/repos/${path}`, {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : undefined,
      next: { revalidate: false },
    });
    if (!response.ok) return project;
    const repository = (await response.json()) as GitHubRepository;
    return {
      ...project,
      description: repository.description ?? project.description,
      repository: repository.html_url,
      github: {
        language: repository.language,
        stars: repository.stargazers_count,
        updatedAt: repository.updated_at.slice(0, 10),
      },
    };
  } catch {
    return project;
  }
}

export async function getProjects() {
  return Promise.all(projects.map(enrichProject));
}

export async function getProject(slug: string) {
  return (await getProjects()).find((project) => project.slug === slug);
}
