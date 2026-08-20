import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    category: z.string(),
    excerpt: z.string(),
    author: z
      .object({
        name: z.string().default('Ollanode Team'),
        role: z.string().default('Engineering'),
        avatar: z.string().default('⚡'),
      })
      .default({
        name: 'Ollanode Team',
        role: 'Engineering',
        avatar: '⚡',
      }),
    publishedDate: z.string(),
    readingTime: z.string().default('5 min read'),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
  }),
});

export const collections = {
  blog: blogCollection,
};
