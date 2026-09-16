import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z.string(),
      category: z.string().default('Product & Changelog'),
      excerpt: z.string().optional(),
      description: z.string().optional(),
      author: z
        .union([
          z.string().transform((name) => ({
            name,
            role: 'Core Team',
            avatar: '⚡',
          })),
          z.object({
            name: z.string().default('The OllaNode Team'),
            role: z.string().default('Core Team'),
            avatar: z.string().default('⚡'),
          }),
        ])
        .default({
          name: 'The OllaNode Team',
          role: 'Core Team',
          avatar: '⚡',
        }),
      publishedDate: z.string().optional(),
      pubDate: z.union([z.string(), z.date()]).optional(),
      readingTime: z.string().default('8 min read'),
      image: z.string().optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
    })
    .transform((data) => ({
      ...data,
      excerpt: data.excerpt || data.description || '',
      publishedDate:
        data.publishedDate ||
        (data.pubDate
          ? typeof data.pubDate === 'string'
            ? data.pubDate
            : data.pubDate.toISOString().split('T')[0]
          : 'August 21, 2026'),
    })),
});

export const collections = {
  blog: blogCollection,
};

