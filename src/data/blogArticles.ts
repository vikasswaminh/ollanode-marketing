import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;

/**
 * Fetch all blog articles sorted by publishedDate (newest first)
 */
export async function getAllBlogArticles(): Promise<BlogEntry[]> {
  try {
    const articles = await getCollection('blog');
    return articles.sort((a, b) => {
      const dateA = new Date(a.data.publishedDate).getTime();
      const dateB = new Date(b.data.publishedDate).getTime();
      return dateB - dateA;
    });
  } catch (e) {
    return [];
  }
}

/**
 * Get featured article for the main big long card (always the single most recent article)
 */
export async function getFeaturedBlogArticle(): Promise<BlogEntry | null> {
  const articles = await getAllBlogArticles();
  if (articles.length === 0) return null;
  return articles[0];
}

/**
 * Get top 3 most recent articles for the left sidebar featured section
 */
export async function getLeftSidebarArticles(): Promise<BlogEntry[]> {
  const articles = await getAllBlogArticles();
  return articles.slice(0, 3);
}

/**
 * Get right sidebar AI & Edge links
 */
export async function getRightSidebarArticles(): Promise<BlogEntry[]> {
  const articles = await getAllBlogArticles();
  const aiOrEdge = articles.filter(
    (a) =>
      a.data.category === 'AI' ||
      a.data.category === 'CDN & Edge' ||
      a.data.tags.some((t) => t.toLowerCase().includes('ai') || t.toLowerCase().includes('edge'))
  );
  return aiOrEdge.length > 0 ? aiOrEdge : articles.slice(0, 6);
}

export const OLLANODE_BLOG_CATEGORIES = [
  'All',
  'Guides',
  'Comparison',
  'Video & CDN',
  'AI & Agents',
  'Engineering',
  'Security, Edge & Performance',
  'Product & Changelog',
] as const;

