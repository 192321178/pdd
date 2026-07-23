package com.sharebite.auth

import android.content.Intent
import android.os.Bundle
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.sharebite.R
import com.sharebite.databinding.ActivityLoginBinding
import com.sharebite.home.HomeActivity

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var auth: FirebaseAuth
    private lateinit var googleSignInClient: GoogleSignInClient

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            firebaseAuthWithGoogle(account.idToken!!)
        } catch (e: ApiException) {
            Toast.makeText(this, "Google sign-in failed. Try again.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        auth = FirebaseAuth.getInstance()

        // Already logged in → go to home
        if (auth.currentUser != null) {
            startActivity(Intent(this, HomeActivity::class.java))
            finish()
            return
        }

        // Google Sign-In setup
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        // ✅ Fix: Eye icon toggle for password visibility
        var isPasswordVisible = false
        binding.ivTogglePassword?.setOnClickListener {
            isPasswordVisible = !isPasswordVisible
            if (isPasswordVisible) {
                binding.etPassword.transformationMethod = HideReturnsTransformationMethod.getInstance()
                binding.ivTogglePassword.setImageResource(android.R.drawable.ic_menu_view)
            } else {
                binding.etPassword.transformationMethod = PasswordTransformationMethod.getInstance()
                binding.ivTogglePassword.setImageResource(android.R.drawable.ic_secure)
            }
            binding.etPassword.setSelection(binding.etPassword.text?.length ?: 0)
        }

        // Login button
        binding.btnSignIn.setOnClickListener {
            val email    = binding.etEmail.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()

            if (email.isEmpty()) {
                binding.etEmail.error = "Email is required"
                binding.etEmail.requestFocus()
                return@setOnClickListener
            }
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                binding.etEmail.error = "Please enter a valid email"
                binding.etEmail.requestFocus()
                return@setOnClickListener
            }
            if (password.isEmpty()) {
                binding.etPassword.error = "Password is required"
                binding.etPassword.requestFocus()
                return@setOnClickListener
            }
            if (password.length < 6) {
                binding.etPassword.error = "Password must be at least 6 characters"
                binding.etPassword.requestFocus()
                return@setOnClickListener
            }

            binding.btnSignIn.isEnabled = false
            binding.btnSignIn.text = "Logging in..."

            auth.signInWithEmailAndPassword(email, password)
                .addOnSuccessListener {
                    Toast.makeText(this, "Welcome back!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this, HomeActivity::class.java))
                    finish()
                }
                .addOnFailureListener { e ->
                    binding.btnSignIn.isEnabled = true
                    binding.btnSignIn.text = "Login"
                    val message = when {
                        e.message?.contains("no user record") == true ->
                            "No account found. Please sign up."
                        e.message?.contains("password is invalid") == true ||
                                e.message?.contains("INVALID_PASSWORD") == true ->
                            "Incorrect password. Please try again."
                        e.message?.contains("badly formatted") == true ->
                            "Please enter a valid email address."
                        else -> "Login failed. Please try again."
                    }
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
        }

        // Google Sign-In button
        binding.btnGoogle.setOnClickListener {
            // Previous sign-in clear பண்ணி fresh account picker காட்டு
            googleSignInClient.signOut().addOnCompleteListener {
                val signInIntent = googleSignInClient.signInIntent
                googleSignInLauncher.launch(signInIntent)
            }
        }

        // Navigate to Sign Up
        binding.tvSignUp.setOnClickListener {
            startActivity(Intent(this, SignUpActivity::class.java))
        }

        // Forgot password
        binding.tvForgotPassword.setOnClickListener {
            val email = binding.etEmail.text.toString().trim()
            if (email.isEmpty()) {
                binding.etEmail.error = "Please enter your email first"
                binding.etEmail.requestFocus()
                return@setOnClickListener
            }
            auth.sendPasswordResetEmail(email)
                .addOnSuccessListener {
                    Toast.makeText(this, "Password reset email sent!", Toast.LENGTH_LONG).show()
                }
                .addOnFailureListener {
                    Toast.makeText(this, "Email not found.", Toast.LENGTH_SHORT).show()
                }
        }
    }

    private fun firebaseAuthWithGoogle(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnSuccessListener {
                Toast.makeText(this, "Welcome!", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, HomeActivity::class.java))
                finish()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Google login failed. Try again.", Toast.LENGTH_SHORT).show()
            }
    }
}