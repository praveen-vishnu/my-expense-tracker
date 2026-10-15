/**
 * Minimal IndexedDB wrapper for PennyWise local-first persistence.
 * Falls back to an in-memory store if indexedDB is unavailable (e.g., in Node tests).
 */

const DB_NAME = 'pennywise_db'
const DB_VERSION = 1
const STORES = ['data_store', 'outbox_store', 'meta_store']

class MemoryStore {
  constructor() {
    this.stores = new Map()
  }

  getStore(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map())
    return this.stores.get(name)
  }

  async get(storeName, key) {
    return this.getStore(storeName).get(key)
  }

  async set(storeName, key, value) {
    this.getStore(storeName).set(key, value)
  }

  async delete(storeName, key) {
    this.getStore(storeName).delete(key)
  }

  async getAll(storeName) {
    return Array.from(this.getStore(storeName).values())
  }

  async clear(storeName) {
    this.getStore(storeName).clear()
  }
}

let dbInstance = null
const isIndexedDBSupported = typeof indexedDB !== 'undefined'

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (!isIndexedDBSupported) {
    dbInstance = new MemoryStore()
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    }

    request.onsuccess = (event) => {
      dbInstance = event.target.result
      resolve(dbInstance)
    }

    request.onerror = (event) => {
      reject(event.target.error)
    }
  })
}

export async function idbGet(storeName, key) {
  const db = await openDB()
  if (db instanceof MemoryStore) return db.get(storeName, key)

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function idbSet(storeName, key, value) {
  const db = await openDB()
  if (db instanceof MemoryStore) return db.set(storeName, key, value)

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function idbDelete(storeName, key) {
  const db = await openDB()
  if (db instanceof MemoryStore) return db.delete(storeName, key)

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function idbGetAll(storeName) {
  const db = await openDB()
  if (db instanceof MemoryStore) return db.getAll(storeName)

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function idbClear(storeName) {
  const db = await openDB()
  if (db instanceof MemoryStore) return db.clear(storeName)

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

