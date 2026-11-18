import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { authErrorMessage } from '../lib/authErrors.js'
import Icon from './Icons.jsx'
import Logo from './Logo.jsx'

// Page de connexion des employés, avec une image en fond (public/images/login-bg.jpg).
// Volontairement SANS bouton « Créer un compte » : les comptes sont créés par l'administrateur
// (et la création publique est aussi désactivée côté Supabase).
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    // En cas de succès, useSession() détecte la session et l'app bascule toute seule.
    if (signInError) setError(authErrorMessage(signInError))
    setSubmitting(false)
  }

  return (
    <main className="login">
      <div className="login-bg" aria-hidden="true" />
      <div className="login-in">
        <section className="login-hero">
          <Logo />
          <div className="login-copy">
            <h1>
              Un geste.
              <br />
              Votre note est <em>envoyée.</em>
            </h1>
          </div>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <h2 id="login-title">Connexion</h2>
          <p className="sub">Accédez à vos notes de frais.</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Adresse email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@entreprise.fr"
                required
              />
            </label>

            <label className="field">
              <span>Mot de passe</span>
              <span className="pw">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  <Icon name={showPassword ? 'eye-off' : 'eye'} />
                </button>
              </span>
            </label>

            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-white btn-block" disabled={submitting}>
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="admin-note">
            <Icon name="lock" />
            <span>Les comptes sont créés par votre administrateur.</span>
          </p>
        </section>
      </div>
    </main>
  )
}
