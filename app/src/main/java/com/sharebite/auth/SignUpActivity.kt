package com.sharebite.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.sharebite.R
import com.sharebite.databinding.ActivitySignupBinding
import com.sharebite.home.HomeActivity

class SignUpActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySignupBinding
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
        binding = ActivitySignupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        auth = FirebaseAuth.getInstance()

        // Google Sign-In setup
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        // Create Account button
        binding.btnSignUp.setOnClickListener {
            val name     = binding.etName.text.toString().trim()
            val email    = binding.etEmail.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()
            val confirm  = binding.etConfirmPassword.text.toString().trim()

            // Validation
            if (name.isEmpty()) {
                binding.etName.error = "Name is required"
                binding.etName.requestFocus()
                return@setOnClickListener
            }
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
            if (confirm.isEmpty()) {
                binding.etConfirmPassword.error = "Please confirm your password"
                binding.etConfirmPassword.requestFocus()
                return@setOnClickListener
            }
            if (password != confirm) {
                binding.etConfirmPassword.error = "Passwords do not match"
                binding.etConfirmPassword.requestFocus()
                return@setOnClickListener
            }

            // Loading state
            binding.btnSignUp.isEnabled = false
            binding.btnSignUp.text = "Creating account..."

            // Firebase signup
            auth.createUserWithEmailAndPassword(email, password)
                .addOnSuccessListener {
                    val profileUpdates = UserProfileChangeRequest.Builder()
                        .setDisplayName(name)
                        .build()
                    // Users collection-ல் save பண்ணு
                    val uid = auth.currentUser?.uid ?: ""
                    val userMap = mapOf(
                        "name"     to name,
                        "email"    to email,
                        "location" to "Coimbatore"
                    )
                    com.google.firebase.database.FirebaseDatabase
                        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
                        .getReference("users")
                        .child(uid)
                        .setValue(userMap)
                    auth.currentUser?.updateProfile(profileUpdates)

                    Toast.makeText(this, "Account created! Welcome!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this, HomeActivity::class.java))
                    finish()
                }
                .addOnFailureListener { e ->
                    binding.btnSignUp.isEnabled = true
                    binding.btnSignUp.text = "Create Account"
                    val message = when {
                        e.message?.contains("already in use") == true ->
                            "This email is already registered."
                        e.message?.contains("badly formatted") == true ->
                            "Please enter a valid email address."
                        else -> "Sign up failed. Please try again."
                    }
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
        }

        // Google Sign-Up button
        binding.btnGoogleSignUp.setOnClickListener {
            googleSignInClient.signOut().addOnCompleteListener {
                val signInIntent = googleSignInClient.signInIntent
                googleSignInLauncher.launch(signInIntent)
            }
        }

        // Navigate back to Login
        binding.tvLogin.setOnClickListener {
            finish()
        }
    }

    private fun firebaseAuthWithGoogle(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnSuccessListener { authResult ->
                // New user-க்கு display name set பண்ணு
                val user = authResult.user
                if (authResult.additionalUserInfo?.isNewUser == true) {
                    val profileUpdates = UserProfileChangeRequest.Builder()
                        .setDisplayName(user?.displayName ?: "User")
                        .build()
                    user?.updateProfile(profileUpdates)
                }
                Toast.makeText(this, "Welcome!", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, HomeActivity::class.java))
                finish()
            }
            .addOnFailureListener {
                Toast.makeText(this, "Google login failed. Try again.", Toast.LENGTH_SHORT).show()
            }
    }
}