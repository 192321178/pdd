package com.sharebite.fragments

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.auth.LoginActivity

class ProfileFragment : Fragment() {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
        .getReference("food_items")
    private val usersDb = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
        .getReference("users")

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_profile, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val currentUser = auth.currentUser ?: return

        val tvName     = view.findViewById<TextView>(R.id.tvProfileName)
        val tvAvatar   = view.findViewById<TextView>(R.id.tvProfileAvatar)
        val tvLocation = view.findViewById<TextView>(R.id.tvProfileLocation)

        // Auto-create user record if not exists (Google sign-in users may not have a record)
        usersDb.child(currentUser.uid).get().addOnSuccessListener { snapshot ->
            if (!snapshot.exists()) {
                val name = currentUser.displayName
                    ?: currentUser.email?.substringBefore("@")
                    ?: "User"
                val userMap = mapOf(
                    "name"     to name,
                    "email"    to (currentUser.email ?: ""),
                    "location" to "Coimbatore"
                )
                usersDb.child(currentUser.uid).setValue(userMap)
            }
        }

        // Profile display — real-time listener for name/location UI only
        usersDb.child(currentUser.uid).addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val name = snapshot.child("name").getValue(String::class.java)
                    ?: currentUser.displayName
                    ?: currentUser.email?.substringBefore("@")
                    ?: "User"
                val location = snapshot.child("location").getValue(String::class.java)
                    ?: "Coimbatore"

                if (!isAdded) return
                tvName.text     = name
                tvAvatar.text   = name.firstOrNull()?.uppercase() ?: "U"
                tvLocation.text = "📍 $location"
            }
            override fun onCancelled(error: DatabaseError) {}
        })

        // ✅ Fix: call loadStats and loadLeaderboard directly with uid — NEVER gate on
        // user record existing. Google sign-in users have no /users/{uid} record initially
        // so the previous usersDb.get() approach returned empty and stats showed 0.
        // uid matching alone is sufficient — all food items store userUid correctly.
        val myName = currentUser.displayName
            ?: currentUser.email?.substringBefore("@")
            ?: "User"
        loadStats(view, currentUser.uid, myName)
        loadLeaderboard(view)

        // ✅ Logout — now a LinearLayout with "Logout →" text
        view.findViewById<LinearLayout>(R.id.btnLogout).setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Logout")
                .setMessage("Are you sure you want to logout?")
                .setPositiveButton("Logout") { _, _ ->
                    auth.signOut()
                    startActivity(Intent(requireContext(), LoginActivity::class.java))
                    requireActivity().finish()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnEditProfile)
            .setOnClickListener {
                showEditProfileDialog(tvName, tvLocation)
            }
    }

    private fun showEditProfileDialog(tvName: TextView, tvLocation: TextView) {
        val currentUser = auth.currentUser ?: return

        val dialogView = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(60, 40, 60, 20)
        }

        val currentLocation = tvLocation.text.toString().removePrefix("📍 ")

        val etName = EditText(requireContext()).apply {
            hint = "Your name"
            setText(tvName.text)
            setPadding(20, 20, 20, 20)
        }
        val etLocation = EditText(requireContext()).apply {
            hint = "Your location"
            setText(currentLocation)
            setPadding(20, 20, 20, 20)
        }

        dialogView.addView(TextView(requireContext()).apply {
            text = "Name"; textSize = 14f; setPadding(0, 0, 0, 8)
        })
        dialogView.addView(etName)
        dialogView.addView(TextView(requireContext()).apply {
            text = "Location"; textSize = 14f; setPadding(0, 24, 0, 8)
        })
        dialogView.addView(etLocation)

        AlertDialog.Builder(requireContext())
            .setTitle("Edit Profile")
            .setView(dialogView)
            .setPositiveButton("Save") { _, _ ->
                val newName     = etName.text.toString().trim()
                val newLocation = etLocation.text.toString().trim()

                if (newName.isEmpty()) {
                    Toast.makeText(requireContext(), "Name cannot be empty!", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val profileUpdates = UserProfileChangeRequest.Builder()
                    .setDisplayName(newName).build()
                currentUser.updateProfile(profileUpdates)

                val userMap = mapOf(
                    "name"     to newName,
                    "location" to newLocation,
                    "email"    to (currentUser.email ?: "")
                )
                usersDb.child(currentUser.uid).setValue(userMap)
                    .addOnSuccessListener {
                        Toast.makeText(requireContext(), "Profile updated! ✅", Toast.LENGTH_SHORT).show()
                    }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun loadStats(view: View, uid: String, userName: String) {
        if (!isAdded) return

        val tvDonations = view.findViewById<TextView>(R.id.tvDonationsCount)
        val tvClaims    = view.findViewById<TextView>(R.id.tvClaimsCount)
        val tvFoodKg    = view.findViewById<TextView>(R.id.tvFoodKg)
        val tvCo2       = view.findViewById<TextView>(R.id.tvCo2Kg)

        // ✅ Read from permanent /user_stats/{uid} — never 0 even after food expires/deleted
        // Stats are written at time of share (donations++) and claim (claims++)
        val statsRef = FirebaseDatabase
            .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
            .getReference("user_stats")
            .child(uid)

        statsRef.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!isAdded) return
                val donations = snapshot.child("donations").getValue(Int::class.java) ?: 0
                val claims    = snapshot.child("claims").getValue(Int::class.java) ?: 0
                val foodKg    = donations * 0.9
                val co2Kg     = donations * 2.5

                tvDonations.text = donations.toString()
                tvClaims.text    = claims.toString()
                tvFoodKg.text    = String.format("%.1f", foodKg)
                tvCo2.text       = String.format("%.1f", co2Kg)

                updateBadges(view, donations, claims)
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }

    private fun updateBadges(view: View, donations: Int, claims: Int) {
        if (!isAdded) return
        val layoutBadges = view.findViewById<LinearLayout>(R.id.layoutBadges)
        layoutBadges.removeAllViews()

        val badges = mutableListOf<Pair<String, String>>()
        if (donations >= 1)  badges.add("⭐" to "First Share")
        if (donations >= 5)  badges.add("🌿" to "Eco Starter")
        if (donations >= 10) badges.add("👥" to "Community Star")
        if (donations >= 20) badges.add("🏆" to "Food Hero")
        if (claims >= 1)     badges.add("🤚" to "First Claim")
        if (badges.isEmpty()) badges.add("🔒" to "No badges yet")

        badges.forEach { (emoji, label) ->
            val badge = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.VERTICAL
                gravity     = android.view.Gravity.CENTER
                setPadding(16, 16, 16, 16)
                layoutParams = LinearLayout.LayoutParams(130, 110).apply { marginEnd = 8 }
                setBackgroundResource(R.drawable.bg_info_box)
            }
            badge.addView(TextView(requireContext()).apply {
                text = emoji; textSize = 22f
                gravity = android.view.Gravity.CENTER
            })
            badge.addView(TextView(requireContext()).apply {
                text = label; textSize = 10f
                gravity = android.view.Gravity.CENTER
                setTextColor(resources.getColor(R.color.green_primary, null))
                textAlignment = View.TEXT_ALIGNMENT_CENTER
            })
            layoutBadges.addView(badge)
        }
    }

    private fun loadLeaderboard(view: View) {
        if (!isAdded) return
        val layoutLeaderboard = view.findViewById<LinearLayout>(R.id.layoutLeaderboard)

        // ✅ Read from permanent /user_stats — always accurate even after food expires
        val leaderboardRef = FirebaseDatabase
            .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
            .getReference("user_stats")

        leaderboardRef.get().addOnSuccessListener { snapshot ->
            if (!isAdded) return@addOnSuccessListener

            data class LeaderEntry(val name: String, val donations: Int)
            val entries = mutableListOf<LeaderEntry>()

            for (child in snapshot.children) {
                val name      = child.child("userName").getValue(String::class.java) ?: "User"
                val donations = child.child("donations").getValue(Int::class.java) ?: 0
                if (donations > 0) entries.add(LeaderEntry(name, donations))
            }

            val sorted = entries.sortedByDescending { it.donations }.take(5)
            layoutLeaderboard.removeAllViews()

            if (sorted.isEmpty()) {
                layoutLeaderboard.addView(TextView(requireContext()).apply {
                    text = "No donations yet. Be the first! 🌟"
                    textSize = 13f
                    setTextColor(resources.getColor(R.color.green_primary, null))
                    gravity = android.view.Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { topMargin = 16 }
                })
                return@addOnSuccessListener
            }

            val medals = listOf("🥇", "🥈", "🥉", "4️⃣", "5️⃣")
            sorted.forEachIndexed { index, entry ->
                val row = LinearLayout(requireContext()).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity     = android.view.Gravity.CENTER_VERTICAL
                    setPadding(0, 14, 0, 14)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                }
                row.addView(TextView(requireContext()).apply {
                    text = medals.getOrElse(index) { "▪" }
                    textSize = 20f
                    layoutParams = LinearLayout.LayoutParams(48, LinearLayout.LayoutParams.WRAP_CONTENT)
                })
                row.addView(TextView(requireContext()).apply {
                    text = entry.name
                    textSize = 15f
                    setTextColor(resources.getColor(R.color.black, null))
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                })
                row.addView(TextView(requireContext()).apply {
                    val foodKg = entry.donations * 0.9
                    text = "${entry.donations} donations · ${String.format("%.1f", foodKg)}kg"
                    textSize = 12f
                    setTextColor(resources.getColor(R.color.green_primary, null))
                })
                layoutLeaderboard.addView(row)

                if (index < sorted.size - 1) {
                    layoutLeaderboard.addView(View(requireContext()).apply {
                        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1)
                        setBackgroundColor(resources.getColor(android.R.color.darker_gray, null))
                        alpha = 0.2f
                    })
                }
            }
        }
    }
}