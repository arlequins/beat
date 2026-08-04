import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { projects } from "~/lib/blog-data";
import { getProject } from "~/lib/github";
import { localizedAlternates } from "~/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const project = await getProject(slug);
  return {
    alternates: localizedAlternates("ko", `/work/${slug}/`),
    description: project?.description,
    title: project?.title ?? "Work",
  };
}

export default async function WorkDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const project = await getProject(slug);
  if (!project) notFound();

  return (
    <article>
      <header className="brand-hero px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-[#79e6e0]"
            href="/#work"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> 프로젝트
          </Link>
          <p className="brand-eyebrow mt-12 text-[#f6c85f]">
            Arlequin / {project.year} · {project.role}
          </p>
          <h1 className="display-serif mt-5 text-4xl leading-[1.04] tracking-[-0.055em] text-balance sm:text-6xl">
            {project.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
            {project.description}
          </p>
        </div>
      </header>
      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-4xl">
          {project.image ? (
            <div className="relative aspect-[16/8] overflow-hidden border border-slate-900/15 shadow-[0.65rem_0.65rem_0_rgba(240,100,73,0.15)]">
              <Image
                alt="AI agent assisted software template"
                className="object-cover"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                src={project.image}
              />
            </div>
          ) : null}
          <a
            className="mt-10 inline-flex items-center gap-2 bg-[#111326] px-5 py-3 text-sm font-semibold text-white shadow-[0.3rem_0.3rem_0_#79e6e0] transition hover:-translate-y-1"
            href={project.repository}
            rel="noreferrer"
            target="_blank"
          >
            GitHub repository{" "}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
          <div className="mt-16 grid gap-10 border-t border-slate-900/20 pt-10 sm:grid-cols-3">
            <h2 className="brand-eyebrow text-[#b63f2d]">Challenge</h2>
            <p className="sm:col-span-2 leading-8 text-slate-700">
              {project.challenge}
            </p>
            <h2 className="brand-eyebrow text-[#075c66]">What I built</h2>
            <ul className="space-y-3 sm:col-span-2">
              {project.highlights.map((item) => (
                <li
                  className="border-l-2 border-[#f06449] pl-4 font-medium"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
            <h2 className="brand-eyebrow text-[#b63f2d]">Outcome</h2>
            <p className="sm:col-span-2 leading-8 text-slate-700">
              {project.outcome}
            </p>
          </div>
          <div className="mt-12 flex flex-wrap gap-2">
            {project.stack.map((item) => (
              <span
                className="border border-slate-900/15 px-3 py-1 text-sm font-medium text-slate-600"
                key={item}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
