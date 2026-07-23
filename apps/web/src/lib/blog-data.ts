export const PostStatus = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  SCHEDULED: "Scheduled",
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export type BlogPost = {
  author: string;
  category: string;
  comments: number;
  content: string[];
  excerpt: string;
  featured?: boolean;
  image: string;
  publishedAt: string;
  readTime: string;
  slug: string;
  status: PostStatus;
  title: string;
  views: number;
};

export const blogPosts: BlogPost[] = [
  {
    author: "Alex Morgan",
    category: "Work",
    comments: 18,
    content: [
      "A useful publishing rhythm is less about producing more and more about reducing the distance between an idea and a clear decision. The best editorial systems make the next action obvious without flattening the work into a checklist.",
      "We began by replacing a collection of disconnected tools with one weekly planning ritual. Drafts were reviewed together, ownership stayed visible, and every article had a reason to exist before anyone opened an editor.",
      "The result was not only a more consistent calendar. Writers spent less time asking for context, editors could spot bottlenecks earlier, and the team had room to improve the quality of every piece.",
    ],
    excerpt:
      "A practical framework for building a calm, repeatable editorial practice that leaves room for better ideas.",
    featured: true,
    image: "/blog/editorial-workspace.jpg",
    publishedAt: "Jul 18, 2026",
    readTime: "7 min read",
    slug: "build-an-editorial-rhythm",
    status: PostStatus.PUBLISHED,
    title: "Build an editorial rhythm your team can keep",
    views: 12_480,
  },
  {
    author: "Jon Bell",
    category: "Design",
    comments: 9,
    content: [
      "A workspace communicates priorities before a meeting begins. Light, movement, sound, and the placement of everyday tools all affect whether a team can focus or collaborate well.",
      "We visited four small studios and found the same pattern: the most effective rooms did not try to serve every mode at once. Instead, they created clear zones and let people choose the environment that matched the task.",
    ],
    excerpt:
      "What thoughtful studios teach us about attention, collaboration, and the spaces between them.",
    image: "/blog/studio-office.jpg",
    publishedAt: "Jul 15, 2026",
    readTime: "5 min read",
    slug: "spaces-that-support-good-work",
    status: PostStatus.PUBLISHED,
    title: "Spaces that support good work",
    views: 8_920,
  },
  {
    author: "Alina Ross",
    category: "Culture",
    comments: 0,
    content: [
      "Remote collaboration improves when teams stop treating every conversation as a meeting. A shared vocabulary for decisions, questions, and work in progress gives people more ways to contribute.",
      "This guide collects the small practices that helped our team make async work feel less transactional and more human.",
    ],
    excerpt:
      "Small practices that make distributed collaboration clearer, kinder, and more resilient.",
    image: "/blog/team-collaboration.jpg",
    publishedAt: "Jul 24, 2026",
    readTime: "6 min read",
    slug: "a-field-guide-to-remote-collaboration",
    status: PostStatus.SCHEDULED,
    title: "A field guide to remote collaboration",
    views: 0,
  },
  {
    author: "Alex Morgan",
    category: "Ideas",
    comments: 0,
    content: [
      "Architecture gives abstract values a physical form. The most memorable public spaces are legible enough to welcome us and surprising enough to reward attention.",
      "These notes are the beginning of a visual essay about civic buildings, everyday rituals, and the details people remember.",
    ],
    excerpt:
      "Notes toward a visual essay on public spaces and the details that make them memorable.",
    image: "/blog/modern-architecture.jpg",
    publishedAt: "Updated 2 hours ago",
    readTime: "4 min read",
    slug: "architecture-for-everyday-life",
    status: PostStatus.DRAFT,
    title: "Architecture for everyday life",
    views: 0,
  },
];

export const blogUsers = [
  {
    email: "alex@example.test",
    initials: "AM",
    joined: "Jan 12, 2026",
    name: "Alex Morgan",
    posts: 24,
    role: "Administrator",
    status: "Active",
  },
  {
    email: "jon@example.test",
    initials: "JB",
    joined: "Feb 03, 2026",
    name: "Jon Bell",
    posts: 16,
    role: "Editor",
    status: "Active",
  },
  {
    email: "alina@example.test",
    initials: "AR",
    joined: "Mar 28, 2026",
    name: "Alina Ross",
    posts: 8,
    role: "Author",
    status: "Active",
  },
  {
    email: "sam@example.test",
    initials: "SK",
    joined: "Jun 07, 2026",
    name: "Sam Kim",
    posts: 2,
    role: "Author",
    status: "Invited",
  },
  {
    email: "leah@example.test",
    initials: "LP",
    joined: "Nov 19, 2025",
    name: "Leah Patel",
    posts: 11,
    role: "Editor",
    status: "Suspended",
  },
] as const;

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
