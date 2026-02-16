const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || ''

function getToken() {
  return localStorage.getItem('token')
}

function setToken(token) {
  localStorage.setItem('token', token)
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

function headers() {
  const h = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

export async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...options.headers },
  })
  if (res.status === 401) {
    logout()
    window.location.reload()
    throw new Error('Unauthorized')
  }
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(text || res.statusText)
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.detail) ? (data.detail[0]?.msg || data.detail.map((d) => d.msg || d).join(', ')) : (typeof data?.detail === 'string' ? data.detail : data?.message || res.statusText)
    throw new Error(msg || 'Request failed')
  }
  return data
}

export { getToken, setToken }
