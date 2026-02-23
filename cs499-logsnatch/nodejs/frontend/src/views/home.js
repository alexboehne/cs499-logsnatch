import React, { useState } from 'react' 
import { Helmet } from 'react-helmet'
import './home.css'

const Home = (props) => {
const [username, setUsername] = useState('')
const [password, setPassword] = useState('')

const handleLogin = (e) => {
  e.preventDefault()

  fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log('Logged in User ID:', data.user.uid);
        alert(`Welcome back, ${data.user.username}!`);
        //added by claude - connect the 2 react apps
        localStorage.setItem('authToken', data.token)
        window.location.href = 'http://localhost:3001/dashboard?token=' + data.token
      } else {
        alert(data.message);
      }
  })   
 .catch((err) => console.error('Login error:', err))
}

const handleUserCreation = (e) => { 
  e.preventDefault()

  fetch('http://localhost:5000/api/createUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        console.log('New User ID:', data.user);
        alert(`Created user \"${data.username}\"`);
      } else {
        alert(data.message);
      }
  })   
 .catch((err) => console.error('Login error:', err))
}

  return (
    <div className="home-container1">
      <Helmet>
        <title>LogSnatch - Login</title>
      </Helmet>
      <img src="/logsnatch-logo-500w.png" alt="logo" className="home-image" />
      <h1 className="home-text1">Welcome to LogSnatch</h1>

      <form className="home-form" onSubmit={handleLogin}>

        <input
          type="text"
          placeholder="ssn"
          className="home-textinput1 input"
          style={{ display: 'none' }} 
        />

        <div className="home-container2">
          <label htmlFor="thq_name_SXRP" className="home-text2">Username</label>
          <input
            type="text"
            placeholder="Username"
            id="thq_name_SXRP"
            className="home-textinput2 input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="home-container3">
          <label htmlFor="thq_email_ktrI" className="home-text3">Password</label>
          <input
            type="password"
            placeholder="Password"
            id="thq_email_ktrI"
            className="home-textinput3 input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="home-button1 button">
          Login
        </button>
        
        <button type="button" className="button">
          Create Account
        </button>
      </form>
    </div>
  )
}

export default Home
