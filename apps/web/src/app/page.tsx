import { ArrowUpRight, GitBranch, Mail, PenLine, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "~/config/site";
import { getProjects } from "~/lib/github";
import { getPosts } from "~/lib/posts";

export default async function HomePage() {
  const posts = await getPosts();
  const projectList = await getProjects();
  const weeklyPosts = posts.filter((post) => post.category === "weekly");
  const deepDivePosts = posts.filter((post) => post.category === "deep-dive");
  const studioPosts = posts.filter((post) => post.category === "studio-log");
  return (
    <>
      <section className="brand-hero px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="brand-eyebrow mb-6 text-[#79e6e0]">
              Arlequin / {siteConfig.role}
            </p>
            <h1 className="display-serif max-w-4xl text-5xl leading-[0.97] font-normal tracking-[-0.055em] text-balance sm:text-7xl lg:text-[5.2rem]">
              {siteConfig.intro}
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
              저는 <strong className="text-white">Arlequin</strong>, 문제와
              방향을 결정하는 소프트웨어 엔지니어입니다.{" "}
              <strong className="text-[#f6c85f]">Lumen</strong>은 구현과
              리서치의 가능성을 비추는 AI 동료입니다. 이곳에는 우리가 함께 만든
              제품과, 사람이 최종 판단한 기록을 남깁니다.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 bg-[#f06449] px-5 py-3 text-sm font-bold text-white shadow-[0.35rem_0.35rem_0_#79e6e0] transition hover:-translate-y-1"
                href="#work"
              >
                프로젝트 보기{" "}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
              <Link
                className="inline-flex items-center gap-2 border border-white/35 px-5 py-3 text-sm font-semibold transition hover:border-[#79e6e0] hover:text-[#79e6e0]"
                href="/posts/"
              >
                세 갈래의 글 읽기{" "}
                <PenLine aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
          <div
            className="stage-card"
            aria-label="Arlequin과 Lumen의 협업을 표현한 다이아몬드와 빛"
            role="img"
          >
            <div className="stage-orbit" />
            <div className="stage-light" />
            <div className="absolute top-8 left-8">
              <p className="brand-eyebrow text-[#f06449]">01 · Direction</p>
              <p className="display-serif mt-2 text-2xl">Arlequin</p>
            </div>
            <div className="absolute right-8 bottom-8 text-right">
              <p className="brand-eyebrow text-[#79e6e0]">02 · Illumination</p>
              <p className="display-serif mt-2 text-2xl">Lumen</p>
            </div>
            <p className="absolute bottom-8 left-8 text-[0.65rem] tracking-[0.16em] text-slate-500 uppercase">
              Human-reviewed by design
            </p>
          </div>
        </div>
      </section>

      <section className="harlequin-band border-b border-slate-900/15 px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-px border border-slate-900/15 bg-slate-900/15 sm:grid-cols-3">
          {[
            ["Direction", "문제와 공개 기준은 Arlequin이 정합니다."],
            ["Illumination", "Lumen이 선택지와 맥락을 넓게 비춥니다."],
            ["Evidence", "코드·출처·검증 결과로 함께 확인합니다."],
          ].map(([title, text], index) => (
            <div className="bg-[#f5f0e6]/95 p-6" key={title}>
              <p className="brand-eyebrow text-[#b63f2d]">
                0{index + 1} · {title}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28" id="work">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="brand-eyebrow text-[#b63f2d]">
                Arlequin / Selected work
              </p>
              <h2 className="display-serif mt-3 text-4xl tracking-[-0.045em] sm:text-5xl">
                판단이 제품이 된 순간들
              </h2>
            </div>
            <a
              className="hidden items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#b63f2d] sm:inline-flex"
              href={siteConfig.links.github}
              rel="noreferrer"
              target="_blank"
            >
              GitHub profile <GitBranch aria-hidden="true" className="size-4" />
            </a>
          </div>
          <div className="grid gap-7 md:grid-cols-2">
            {projectList.map((project, index) => (
              <article
                className={`project-card group flex min-h-96 flex-col p-7 sm:p-8 ${index === 0 ? "md:col-span-2 md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-10" : ""}`}
                key={project.slug}
              >
                {project.image ? (
                  <div className="relative mb-7 aspect-[16/9] overflow-hidden md:mb-0">
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      src={project.image}
                    />
                  </div>
                ) : null}
                <div className="flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <span className="brand-eyebrow text-slate-500">
                      0{index + 1} · {project.year}
                    </span>
                    <a
                      aria-label={`${project.title} repository`}
                      className="border border-slate-900/20 p-2 transition hover:bg-[#111326] hover:text-white"
                      href={project.repository}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  </div>
                  <h3 className="display-serif mt-10 text-3xl tracking-[-0.04em]">
                    <Link
                      className="hover:text-[#b63f2d]"
                      href={`/work/${project.slug}/`}
                    >
                      {project.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-xs font-semibold tracking-[0.08em] text-slate-500 uppercase">
                    {project.role}
                  </p>
                  <p className="mt-5 leading-7 text-slate-700">
                    {project.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-8">
                    {project.stack.map((item) => (
                      <span
                        className="border border-slate-900/15 px-3 py-1 text-xs font-medium"
                        key={item}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-900/15 bg-[#ebe2d4] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="brand-eyebrow text-[#075c66]">Lumen / Writing</p>
              <h2 className="display-serif mt-3 text-4xl tracking-[-0.045em] sm:text-5xl">
                흐름을 비추고, 기술을 깊게 봅니다
              </h2>
            </div>
            <Link
              className="text-sm font-semibold text-slate-600 hover:text-slate-950"
              href="/posts/"
            >
              모든 글 보기
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                accent: "#f06449",
                posts: weeklyPosts.slice(0, 2),
                title: "주간 IT 브리핑",
                kicker: "The changing scene",
              },
              {
                accent: "#07959a",
                posts: deepDivePosts.slice(0, 2),
                title: "테크 딥다이브",
                kicker: "The focused light",
              },
              {
                accent: "#9b4f96",
                posts: studioPosts.slice(0, 2),
                title: "Backstage · 제작의 기록",
                kicker: "History & footage",
              },
            ].map((group) => (
              <div className="paper-panel p-7 sm:p-8" key={group.title}>
                <div
                  className="h-2 w-12"
                  style={{ backgroundColor: group.accent }}
                />
                <p className="brand-eyebrow mt-6 text-slate-500">
                  {group.kicker}
                </p>
                <h3 className="display-serif mt-2 text-3xl">{group.title}</h3>
                <div className="mt-7 divide-y divide-slate-900/15 border-t border-slate-900/15">
                  {group.posts.map((post) => (
                    <Link
                      className="group block py-5"
                      href={`/posts/${post.slug}/`}
                      key={post.slug}
                    >
                      <div className="flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                        <span>{post.publishedAt}</span>
                        {post.reviewStatus === "unreviewed" ? (
                          <span className="text-[#b63f2d]">· 미확정본</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-lg font-semibold leading-7 group-hover:text-[#b63f2d]">
                        {post.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden bg-[#35132f] px-7 py-14 text-white sm:px-12 sm:py-20">
          <div className="absolute -top-10 -right-10 size-48 rotate-45 border-[3rem] border-[#f06449]/20" />
          <div className="relative grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="brand-eyebrow flex items-center gap-2 text-[#f6c85f]">
                <Sparkles aria-hidden="true" className="size-4" /> A dialogue,
                not a shortcut
              </p>
              <h2 className="display-serif mt-4 max-w-3xl text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">
                AI가 만든 결과보다, 함께 내린 판단을 보여주는 포트폴리오.
              </h2>
              <p className="mt-5 max-w-2xl leading-7 text-rose-100/75">
                Arlequin과 Lumen의 대화는 숨기지 않습니다. 무엇을 맡겼고 무엇을
                검토했는지, 결과와 함께 과정도 공개합니다.
              </p>
            </div>
            <a
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#79e6e0] hover:text-white"
              href={`mailto:${siteConfig.email}`}
            >
              연락하기 <Mail aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
