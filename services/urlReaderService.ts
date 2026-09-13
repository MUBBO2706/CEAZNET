import { getAiClient } from "./aiClient";
import { Type } from "@google/genai";
import axios from 'axios';
import { supabase } from "./supabaseClient";

export const fetchAndParseUrlContent = async (url: string): Promise<{ title: string, content: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
          throw new Error("You must be logged in to read and extract URLs.");
      }

      // Check cache first
      const { data: cached } = await supabase
          .from('public_article_cache')
          .select('title, content')
          .eq('article_url', url)
          .maybeSingle();

      if (cached && cached.content) {
          return { title: cached.title, content: cached.content };
      }

      const response = await axios.post('/api/url-reader', { url }, {
          headers: {
              'Authorization': `Bearer ${session.access_token}`
          }
      });
      const data = response.data;

      if (data.error) {
        throw new Error(`Error from url-reader function: ${data.error}`);
      }

      if (!data || !data.content) {
          throw new Error("The URL reader function returned empty content.");
      }
      
      // Save to cache before returning
      const { error: insertError } = await supabase.from('public_article_cache').upsert({
          article_url: url,
          title: data.title,
          content: data.content
      }, { onConflict: 'article_url', ignoreDuplicates: true });
      if (insertError) {
          console.warn("Failed to cache article:", insertError);
      }

      return { title: data.title, content: data.content };

    } catch (error) {
        console.error("Error in fetchAndParseUrlContent:", error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not parse content from the URL. (Details: ${errorMessage})`);
    }
};