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
 * Get featured article (article with featured: true, or the newest article)
 */
export async function getFeaturedBlogArticle(): Promise<BlogEntry | null> {
  const articles = await getAllBlogArticles();
  if (articles.length === 0) return null;
  const featured = articles.find((a) => a.data.featured === true);
  return featured || articles[0];
}

/**
 * Get left sidebar featured links
 */
export async function getLeftSidebarArticles(): Promise<BlogEntry[]> {
  const articles = await getAllBlogArticles();
  const featured = articles.filter((a) => a.data.featured === true);
  return featured.length > 0 ? featured : articles.slice(0, 6);
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
  'Comparisons',
  'Video & CDN',
  'AI & Agents',
  'Engineering',
  'Security, Edge & Performance',
  'Product & Changelog',
] as const;

