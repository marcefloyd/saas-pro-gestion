import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ffzffhxexxtreuqksvdy.supabase.co' 
const SUPABASE_ANON_KEY = 'sb_publishable_5FHBhxV0i5sM4vzyRlI4Tg_jjC4Y6ip' 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const loginForm = document.getElementById('login-form')
const loginError = document.getElementById('login-error')

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('login-email').value
    const password = document.getElementById('login-password').value
    loginError.textContent = ''

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        })

        if (error) throw error

        // Esperamos un momento a que la cookie/sesión de Supabase se guarde bien antes de redirigir
        setTimeout(() => {
            window.location.href = 'admin.html'
        }, 500)

    } catch (error) {
        loginError.textContent = "Error: Verifique su correo o contraseña."
        console.error(error)
    }
})