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

        // ✅ User data இல்லன்னா auto create பண்ணு
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

        // Profile data load
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
                tvLocation.text = location

                loadStats(view, currentUser.uid, name)
            }
            override fun onCancelled(error: DatabaseError) {}
        })

        view.findViewById<TextView>(R.id.btnLogout).setOnClickListener {
            auth.signOut()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }

        view.findViewById<TextView>(R.id.btnEditProfile).setOnClickListener {
            showEditProfileDialog(tvName, tvLocation)
        }

        loadLeaderboard(view)
    }

    private fun showEditProfileDialog(tvName: TextView, tvLocation: TextView) {
        val currentUser = auth.currentUser ?: return

        val dialogView = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(60, 40, 60, 20)
        }

        val etName = EditText(requireContext()).apply {
            hint = "Your name"
            setText(tvName.text)
            setPadding(20, 20, 20, 20)
        }
        val etLocation = EditText(requireContext()).apply {
            hint = "Your location"
            setText(tvLocation.text)
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

        db.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!isAdded) return

                var donations = 0
                var claims    = 0

                for (child in snapshot.children) {
                    val item = child.getValue(FoodItem::class.java) ?: continue

                    // UID match (new data) + name match (old data) — இரண்டும் check பண்ணு
                    val isDonor = item.userUid == uid ||
                            (item.userUid.isEmpty() && item.userName == userName)
                    val isClaimer = item.claimedByUid == uid

                    if (isDonor)   donations++
                    if (isClaimer) claims++
                }

                val foodKg = donations * 0.9
                val co2Kg  = donations * 2.5

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
        val userDonations = mutableMapOf<String, Pair<String, Int>>()

        db.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!isAdded) return
                userDonations.clear()

                for (child in snapshot.children) {
                    val item = child.getValue(FoodItem::class.java) ?: continue
                    if (item.userUid.isEmpty()) {
                        val name = item.userName.ifEmpty { "Anonymous" }
                        val existing = userDonations[name] ?: Pair(name, 0)
                        userDonations[name] = Pair(name, existing.second + 1)
                    } else {
                        val existing = userDonations[item.userUid] ?: Pair(item.userName, 0)
                        userDonations[item.userUid] = Pair(
                            item.userName.ifEmpty { "User" }, existing.second + 1
                        )
                    }
                }

                val sorted = userDonations.values.sortedByDescending { it.second }.take(5)
                layoutLeaderboard.removeAllViews()
                val medals = listOf("🥇", "🥈", "🥉", "4️⃣", "5️⃣")

                sorted.forEachIndexed { index, (name, count) ->
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
                        layoutParams = LinearLayout.LayoutParams(
                            48, LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                    })
                    row.addView(TextView(requireContext()).apply {
                        text = name
                        textSize = 15f
                        setTextColor(resources.getColor(R.color.black, null))
                        layoutParams = LinearLayout.LayoutParams(
                            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
                        )
                    })
                    row.addView(TextView(requireContext()).apply {
                        val foodKg = count * 0.9
                        text = "$count donations · ${String.format("%.1f", foodKg)}kg"
                        textSize = 12f
                        setTextColor(resources.getColor(R.color.green_primary, null))
                    })
                    layoutLeaderboard.addView(row)

                    if (index < sorted.size - 1) {
                        layoutLeaderboard.addView(View(requireContext()).apply {
                            layoutParams = LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT, 1
                            )
                            setBackgroundColor(
                                resources.getColor(android.R.color.darker_gray, null)
                            )
                            alpha = 0.2f
                        })
                    }
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }
}