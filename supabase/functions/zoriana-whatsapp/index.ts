import { createHandler } from './handler.mjs';

Deno.serve(createHandler({
  getEnv: (name: string) => Deno.env.get(name),
  replyScope: {
    projectUrl: 'https://lewvadmakzatxgrllqzk.supabase.co',
    phoneNumberId: '1473706715820066',
  },
}));
