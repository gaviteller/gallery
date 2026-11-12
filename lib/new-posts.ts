"use client"
/**
 * Posts you made since the page loaded. The feed is frozen to when the page opened,
 * so these are shown pinned at the top until the next full reload (which clears this
 * store and ranks them normally).
 */
import { useSyncExternalStore } from "react"
import type { FeedPostData } from "@/components/redesign/FeedParts"

let posts: FeedPostData[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function addNewPost(post: FeedPostData) {
  posts = [post, ...posts.filter((p) => p.id !== post.id)]
  emit()
}

export function updateNewPost(id: string, change: (post: FeedPostData) => FeedPostData) {
  if (!posts.some((p) => p.id === id)) return
  posts = posts.map((p) => (p.id === id ? change(p) : p))
  emit()
}

export function removeNewPost(id: string) {
  posts = posts.filter((p) => p.id !== id)
  emit()
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const empty: FeedPostData[] = []
export function useNewPosts() {
  return useSyncExternalStore(subscribe, () => posts, () => empty)
}
