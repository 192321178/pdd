package com.sharebite.home

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RatingBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.MutableData
import com.google.firebase.database.Transaction
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.fragments.ChatPreview
import com.sharebite.fragments.FoodDataStore
import com.sharebite.fragments.FoodItem
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FoodDetailActivity : AppCompatActivity() {

    private var countDownTimer: CountDownTimer? = null
    private var foodListener: ValueEventListener? = null

    private val rtdb = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_food_detail)

        // ── Get item ID from intent ──────────────────────────────────────────
        val itemId = intent.getStringExtra("item_id")
        if (itemId.isNullOrEmpty()) { finish(); return }

        val currentUser = FirebaseAuth.getInstance().currentUser
        val myUid  = currentUser?.uid ?: ""
        val myName = currentUser?.displayName
            ?: currentUser?.email?.substringBefore("@") ?: "User"

        // ── Get all views from layout ────────────────────────────────────────
        val btnBack        = findViewById<View>(R.id.btnBack)
        val imgDetail      = findViewById<ImageView>(R.id.imgDetail)
        val viewDimOverlay = findViewById<View>(R.id.viewDimOverlay)
        val layoutClaimed  = findViewById<LinearLayout>(R.id.layoutClaimed)
        val tvCountdown    = findViewById<TextView>(R.id.tvCountdown)
        val tvCategory     = findViewById<TextView>(R.id.tvDetailCategory)
        val tvFoodName     = findViewById<TextView>(R.id.tvDetailFoodName)
        val tvQuantity     = findViewById<TextView>(R.id.tvDetailQuantity)
        val tvLocation     = findViewById<TextView>(R.id.tvDetailLocation)
        val tvPickup       = findViewById<TextView>(R.id.tvDetailPickup)
        val tvDesc         = findViewById<TextView>(R.id.tvDetailDesc)
        val tvDonorName    = findViewById<TextView>(R.id.tvDonorName)
        val tvDonorAvatar  = findViewById<TextView>(R.id.tvDonorAvatar)
        val btnClaim       = findViewById<Button>(R.id.btnClaimFood)
        val btnMessage     = findViewById<Button>(R.id.btnMessageDonor)

        btnBack?.setOnClickListener { finish() }

        // ── keepSynced — always get fresh data from server ───────────────────
        rtdb.getReference("food_items").child(itemId).keepSynced(true)

        // ── Real-time listener — ALL UI driven from live Firebase data ───────
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val item = snapshot.getValue(FoodItem::class.java) ?: run {
                    Toast.makeText(this@FoodDetailActivity, "Item not found!", Toast.LENGTH_SHORT).show()
                    finish()
                    return
                }

                // ── Populate UI ──────────────────────────────────────────────
                tvCategory?.text  = item.category
                tvFoodName?.text  = item.foodName
                tvQuantity?.text  = item.quantity
                tvLocation?.text  = item.location.ifEmpty { "Location not specified" }
                tvPickup?.text    = "Now · ${item.location.ifEmpty { "Nearby" }}"
                tvDesc?.text      = item.description.ifEmpty { "No description" }
                val donorDisplay  = if (item.isAnonymous) "Anonymous" else item.userName
                tvDonorName?.text   = donorDisplay
                tvDonorAvatar?.text = donorDisplay.firstOrNull()?.uppercase() ?: "U"

                // ── Load image ───────────────────────────────────────────────
                if (!item.imageUri.isNullOrEmpty() && imgDetail != null) {
                    try {
                        val src: Any = when {
                            item.imageUri.startsWith("data:image") -> {
                                val b64   = item.imageUri.substringAfter("base64,")
                                val bytes = android.util.Base64.decode(b64, android.util.Base64.NO_WRAP)
                                android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                            }
                            item.imageUri.startsWith("/")    -> File(item.imageUri)
                            item.imageUri.startsWith("http") -> item.imageUri
                            else -> item.imageUri
                        }
                        com.bumptech.glide.Glide.with(this@FoodDetailActivity)
                            .load(src).centerCrop()
                            .placeholder(android.R.drawable.ic_menu_gallery)
                            .error(android.R.drawable.ic_menu_gallery)
                            .into(imgDetail)
                    } catch (e: Exception) { /* silent */ }
                }

                // ── Countdown timer ──────────────────────────────────────────
                countDownTimer?.cancel()
                val remaining = item.expiryTimeMillis - System.currentTimeMillis()
                if (item.expiryTimeMillis > 0 && remaining > 0) {
                    countDownTimer = object : CountDownTimer(remaining, 1000) {
                        override fun onTick(ms: Long) {
                            val h = ms / 3600000
                            val m = (ms % 3600000) / 60000
                            val s = (ms % 60000) / 1000
                            tvCountdown?.text = String.format("%02d : %02d : %02d", h, m, s)
                        }
                        override fun onFinish() { tvCountdown?.text = "Expired!" }
                    }.start()
                } else if (item.expiryTimeMillis > 0) {
                    tvCountdown?.text = "Expired!"
                }

                // ── Determine relationship to item ───────────────────────────
                val isMyListing   = myUid.isNotEmpty() && item.userUid == myUid
                val isClaimedByMe = item.isClaimed && myUid.isNotEmpty() && item.claimedByUid == myUid
                val donorUid      = item.userUid
                val chatId        = if (myUid < donorUid) "${myUid}_${donorUid}"
                else "${donorUid}_${myUid}"

                // ── Button visibility rules ──────────────────────────────────
                // Reset click listeners every time to avoid stale closures
                btnClaim?.setOnClickListener(null)
                btnMessage?.setOnClickListener(null)

                when {
                    // CASE 1: My own listing
                    isMyListing -> {
                        layoutClaimed?.visibility  = View.GONE
                        viewDimOverlay?.visibility = View.GONE
                        btnClaim?.visibility       = View.GONE
                        btnMessage?.visibility     = View.GONE
                    }

                    // CASE 2: I already claimed this
                    isClaimedByMe -> {
                        layoutClaimed?.visibility  = View.VISIBLE
                        viewDimOverlay?.visibility = View.VISIBLE
                        btnClaim?.visibility       = View.VISIBLE
                        btnClaim?.isEnabled        = false
                        btnClaim?.text             = "✓ Already Claimed By You"
                        btnClaim?.alpha            = 0.6f
                        btnMessage?.visibility     = View.VISIBLE
                        btnMessage?.isEnabled      = true
                        btnMessage?.alpha          = 1.0f
                        btnMessage?.setOnClickListener {
                            openChat(chatId, donorUid, donorDisplay, item.foodName, myUid, myName)
                        }
                    }

                    // CASE 3: Someone else claimed — hide both
                    item.isClaimed -> {
                        layoutClaimed?.visibility  = View.VISIBLE
                        viewDimOverlay?.visibility = View.VISIBLE
                        btnClaim?.visibility       = View.GONE
                        btnMessage?.visibility     = View.GONE
                    }

                    // CASE 4: Not claimed — show both active
                    else -> {
                        layoutClaimed?.visibility  = View.GONE
                        viewDimOverlay?.visibility = View.GONE
                        btnClaim?.visibility       = View.VISIBLE
                        btnClaim?.isEnabled        = true
                        btnClaim?.text             = "CLAIM FOOD"
                        btnClaim?.alpha            = 1.0f
                        btnMessage?.visibility     = View.VISIBLE
                        btnMessage?.isEnabled      = true
                        btnMessage?.alpha          = 1.0f

                        btnMessage?.setOnClickListener {
                            if (myUid.isEmpty()) {
                                Toast.makeText(this@FoodDetailActivity, "Please login first!", Toast.LENGTH_SHORT).show()
                                return@setOnClickListener
                            }
                            openChat(chatId, donorUid, donorDisplay, item.foodName, myUid, myName)
                        }

                        btnClaim?.setOnClickListener {
                            if (myUid.isEmpty()) {
                                Toast.makeText(this@FoodDetailActivity, "Please login first!", Toast.LENGTH_SHORT).show()
                                return@setOnClickListener
                            }

                            // Disable immediately — block double tap
                            btnClaim.isEnabled = false
                            btnClaim.text      = "Checking..."

                            // ════════════════════════════════════════════════
                            // TWO-STEP CLAIM
                            // Step 1: Fresh server GET — never use cache
                            // Step 2: Atomic transaction — server-side guard
                            // ════════════════════════════════════════════════
                            rtdb.getReference("food_items").child(itemId).get()
                                .addOnSuccessListener { freshSnap ->
                                    val fresh = freshSnap.getValue(FoodItem::class.java)

                                    if (fresh == null) {
                                        runOnUiThread {
                                            Toast.makeText(this@FoodDetailActivity, "Food not found!", Toast.LENGTH_SHORT).show()
                                            btnClaim.isEnabled = true
                                            btnClaim.text      = "CLAIM FOOD"
                                        }
                                        return@addOnSuccessListener
                                    }

                                    // Already claimed by ME
                                    if (fresh.claimedByUid == myUid) {
                                        runOnUiThread {
                                            btnClaim.text  = "✓ Already Claimed By You"
                                            btnClaim.alpha = 0.6f
                                            Toast.makeText(this@FoodDetailActivity, "You already claimed this food!", Toast.LENGTH_SHORT).show()
                                        }
                                        return@addOnSuccessListener
                                    }

                                    // Already claimed by someone else
                                    if (fresh.isClaimed) {
                                        runOnUiThread {
                                            btnClaim.visibility   = View.GONE
                                            btnMessage?.visibility = View.GONE
                                            Toast.makeText(this@FoodDetailActivity, "Already claimed by someone else!", Toast.LENGTH_SHORT).show()
                                        }
                                        return@addOnSuccessListener
                                    }

                                    // Step 2: Atomic transaction
                                    runOnUiThread { btnClaim.text = "Claiming..." }

                                    rtdb.getReference("food_items").child(itemId)
                                        .runTransaction(object : Transaction.Handler {
                                            override fun doTransaction(currentData: MutableData): Transaction.Result {
                                                if (currentData.value == null) return Transaction.abort()
                                                val current = currentData.getValue(FoodItem::class.java)
                                                    ?: return Transaction.abort()
                                                if (current.isClaimed || current.claimedByUid == myUid)
                                                    return Transaction.abort()
                                                currentData.child("isClaimed").value    = true
                                                currentData.child("claimedByUid").value = myUid
                                                return Transaction.success(currentData)
                                            }

                                            override fun onComplete(
                                                error: DatabaseError?,
                                                committed: Boolean,
                                                snapshot: DataSnapshot?
                                            ) {
                                                if (!committed || error != null) {
                                                    runOnUiThread {
                                                        if (error != null) {
                                                            btnClaim.isEnabled = true
                                                            btnClaim.text      = "CLAIM FOOD"
                                                            Toast.makeText(this@FoodDetailActivity, "Network error. Try again.", Toast.LENGTH_SHORT).show()
                                                        } else {
                                                            Toast.makeText(this@FoodDetailActivity, "Already claimed!", Toast.LENGTH_SHORT).show()
                                                        }
                                                    }
                                                    return
                                                }

                                                // ── Claim succeeded ──────────────────────────
                                                FoodDataStore.updateClaimed(itemId, myUid)

                                                // Generate OTP first — used below when saving to food item
                                                val otp = (1000..9999).random()

                                                // Save claimer name + OTP to food item for donor verify
                                                rtdb.getReference("food_items").child(itemId)
                                                    .updateChildren(mapOf(
                                                        "claimerName" to myName,
                                                        "claimOtp"    to otp
                                                    ))

                                                // Increment permanent claims counter
                                                val statsRef = rtdb.getReference("user_stats").child(myUid)
                                                statsRef.child("userName").setValue(myName)
                                                statsRef.child("claims").get().addOnSuccessListener { s ->
                                                    statsRef.child("claims").setValue(
                                                        (s.getValue(Int::class.java) ?: 0) + 1
                                                    )
                                                }

                                                // System message
                                                val timeStr = SimpleDateFormat(
                                                    "dd MMM yyyy, hh:mm a", Locale.getDefault()
                                                ).format(Date())
                                                val sysMsg = "[ShareBite System] ✅ Claim Confirmed\n" +
                                                        "Food: ${item.foodName}\n" +
                                                        "Claimed by: $myName\n" +
                                                        "Claim OTP: $otp\n" +
                                                        "Time: $timeStr"

                                                runOnUiThread {
                                                    Toast.makeText(this@FoodDetailActivity,
                                                        "Food Claimed! 🎉 OTP: $otp", Toast.LENGTH_LONG).show()
                                                }

                                                // Push system message
                                                val chatsRef = rtdb.getReference("chats").child(chatId)
                                                val msgKey   = chatsRef.push().key ?: return
                                                chatsRef.child(msgKey).setValue(mapOf(
                                                    "messageId"  to msgKey,
                                                    "senderId"   to "SYSTEM",
                                                    "senderName" to "ShareBite",
                                                    "message"    to sysMsg,
                                                    "timestamp"  to System.currentTimeMillis()
                                                ))

                                                // Write chat previews
                                                val now = System.currentTimeMillis()
                                                val userChatsRef = rtdb.getReference("user_chats")
                                                userChatsRef.child(myUid).child(chatId).setValue(
                                                    ChatPreview(chatId, donorUid, donorDisplay, item.foodName, "✅ Claim confirmed", now)
                                                )
                                                if (donorUid.isNotEmpty()) {
                                                    userChatsRef.child(donorUid).child(chatId).setValue(
                                                        ChatPreview(chatId, myUid, myName, item.foodName, "✅ Claim confirmed", now)
                                                    )
                                                }

                                                // Navigate to chat
                                                runOnUiThread {
                                                    val intent = Intent(this@FoodDetailActivity, ChatActivity::class.java)
                                                    intent.putExtra("chat_id",       chatId)
                                                    intent.putExtra("other_name",    donorDisplay)
                                                    intent.putExtra("other_user_id", donorUid)
                                                    intent.putExtra("food_name",     item.foodName)
                                                    startActivity(intent)
                                                }
                                            }
                                        })
                                }
                                .addOnFailureListener {
                                    runOnUiThread {
                                        btnClaim.isEnabled = true
                                        btnClaim.text      = "CLAIM FOOD"
                                        Toast.makeText(this@FoodDetailActivity, "Network error. Try again.", Toast.LENGTH_SHORT).show()
                                    }
                                }
                        }
                    }
                }

                // ── Hamburger menu setup with latest item data ───────────────
                val btnMenu = findViewById<View>(R.id.btnMenu)
                btnMenu?.setOnClickListener {
                    showHamburgerMenu(item, myUid, myName, donorUid, donorDisplay, chatId)
                }

                // ── Check if OTP was just verified and rating is pending ──────
                // Only show to claimer after donor verifies
                val pendingRatingFor = snapshot.child("pendingRatingFor")
                    .getValue(String::class.java) ?: ""
                if (pendingRatingFor == myUid && !isMyListing) {
                    showRatingDialog(item, myUid, myName, donorUid)
                }

                // ── View Reviews button ──────────────────────────────────────
                val btnViewReviews = findViewById<TextView>(R.id.tvViewReviews)
                btnViewReviews?.setOnClickListener {
                    showFeedbackScreen(donorUid, donorDisplay)
                }

                // ── Load and display donor average rating ─────────────────────
                rtdb.getReference("user_stats").child(donorUid)
                    .addListenerForSingleValueEvent(object : ValueEventListener {
                        override fun onDataChange(s: DataSnapshot) {
                            val avg       = s.child("avgRating").getValue(Double::class.java) ?: 0.0
                            val count     = s.child("totalRatings").getValue(Int::class.java) ?: 0
                            val donations = s.child("donations").getValue(Int::class.java) ?: 0
                            val tvDonorRating = findViewById<TextView>(R.id.tvDonorRating)
                            tvDonorRating?.text = if (count > 0)
                                "★ $avg · $donations donations"
                            else if (donations > 0)
                                "★ New · $donations donations"
                            else "★ New"
                        }
                        override fun onCancelled(e: DatabaseError) {}
                    })
            }

            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(this@FoodDetailActivity, "Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }

        foodListener = listener
        rtdb.getReference("food_items").child(itemId).addValueEventListener(listener)
    }

    // ── Hamburger menu with 3 options ────────────────────────────────────────
    private fun showHamburgerMenu(
        item: FoodItem, myUid: String, myName: String,
        donorUid: String, donorDisplay: String, chatId: String
    ) {
        val isMyListing = myUid == item.userUid
        val isClaimedByMe = item.isClaimed && item.claimedByUid == myUid

        val options = mutableListOf<String>()
        if (isMyListing && item.isClaimed) options.add("✅ Verify OTP")
        options.add("⭐ Feedback & Reviews")
        options.add("📋 Food History")

        AlertDialog.Builder(this)
            .setTitle("Menu")
            .setItems(options.toTypedArray()) { _, which ->
                when (options[which]) {
                    "✅ Verify OTP"        -> showVerifyOtpDialog(item, myUid, myName)
                    "⭐ Feedback & Reviews" -> showFeedbackScreen(item.userUid, item.userName)
                    "📋 Food History"      -> {
                        val intent = Intent(this, FoodHistoryActivity::class.java)
                        intent.putExtra("uid", myUid)
                        intent.putExtra("user_name", myName)
                        startActivity(intent)
                    }
                }
            }
            .show()
    }

    // ── Verify OTP (donor only) ───────────────────────────────────────────────
    private fun showVerifyOtpDialog(item: FoodItem, myUid: String, myName: String) {
        if (myUid != item.userUid) {
            Toast.makeText(this, "Only the donor can verify OTP", Toast.LENGTH_SHORT).show()
            return
        }
        if (!item.isClaimed) {
            Toast.makeText(this, "This food has not been claimed yet", Toast.LENGTH_SHORT).show()
            return
        }

        val input = EditText(this).apply {
            hint = "Enter claimer's OTP"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            textSize = 18f
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this)
            .setTitle("🔐 Verify OTP")
            .setMessage("Ask the claimer to show their OTP and enter it below:")
            .setView(input)
            .setPositiveButton("Verify") { _, _ ->
                val enteredOtp = input.text.toString().trim()
                val actualOtp  = item.claimOtp.toString()

                if (enteredOtp != actualOtp) {
                    Toast.makeText(this, "❌ Invalid OTP. Please try again.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                // ✅ OTP matched — verification successful
                val now     = System.currentTimeMillis()
                val timeStr = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date(now))
                val claimerUid  = item.claimedByUid
                val claimerName = item.claimerName.ifEmpty { "Claimer" }
                val chatId      = if (myUid < claimerUid) "${myUid}_${claimerUid}"
                else "${claimerUid}_${myUid}"

                // Mark as verified in Firebase
                rtdb.getReference("food_items").child(item.id).child("isVerified").setValue(true)
                rtdb.getReference("food_items").child(item.id).child("verifiedAt").setValue(now)

                // Save to food history — donor side
                rtdb.getReference("food_history").child(myUid).child("donated").child(item.id)
                    .setValue(mapOf(
                        "foodName"    to item.foodName,
                        "claimerName" to claimerName,
                        "claimerUid"  to claimerUid,
                        "verifiedAt"  to now,
                        "location"    to item.location,
                        "category"    to item.category
                    ))

                // Save to food history — claimer side
                rtdb.getReference("food_history").child(claimerUid).child("claimed").child(item.id)
                    .setValue(mapOf(
                        "foodName"   to item.foodName,
                        "donorName"  to myName,
                        "donorUid"   to myUid,
                        "receivedAt" to now,
                        "location"   to item.location,
                        "category"   to item.category
                    ))

                // Send success message to claimer's chat
                val successMsg = "$claimerName, you successfully received '${item.foodName}' at $timeStr 🎉"
                val chatsRef   = rtdb.getReference("chats").child(chatId)
                val msgKey     = chatsRef.push().key ?: return@setPositiveButton
                chatsRef.child(msgKey).setValue(mapOf(
                    "messageId"  to msgKey,
                    "senderId"   to "SYSTEM",
                    "senderName" to "ShareBite",
                    "message"    to successMsg,
                    "timestamp"  to now
                ))

                // Update chat preview
                rtdb.getReference("user_chats").child(claimerUid).child(chatId)
                    .child("lastMessage").setValue(successMsg)
                rtdb.getReference("user_chats").child(claimerUid).child(chatId)
                    .child("timestamp").setValue(now)

                // Show donor success message
                AlertDialog.Builder(this)
                    .setTitle("✅ Verified!")
                    .setMessage("$myName, you successfully donated '${item.foodName}' to $claimerName at $timeStr")
                    .setPositiveButton("OK") { _, _ ->
                        // Trigger rating dialog for claimer (notify via Firebase flag)
                        rtdb.getReference("food_items").child(item.id)
                            .child("pendingRatingFor").setValue(claimerUid)
                    }
                    .show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Rating dialog (shown to claimer after OTP verified) ──────────────────
    private fun showRatingDialog(item: FoodItem, myUid: String, myName: String, donorUid: String) {
        val dialogView = layoutInflater.inflate(android.R.layout.select_dialog_item, null)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 16)
        }
        val ratingBar = RatingBar(this).apply {
            numStars  = 5
            stepSize  = 1f
            rating    = 5f
        }
        val etFeedback = EditText(this).apply {
            hint    = "Write your feedback about this food..."
            minLines = 3
            maxLines = 5
            setPadding(0, 16, 0, 0)
        }
        val tvTitle = TextView(this).apply {
            text     = "Rate ${if (item.isAnonymous) "this food" else item.userName + "'s food"}"
            textSize = 16f
            setPadding(0, 0, 0, 16)
        }
        layout.addView(tvTitle)
        layout.addView(ratingBar)
        layout.addView(etFeedback)

        AlertDialog.Builder(this)
            .setTitle("⭐ Rate This Food")
            .setView(layout)
            .setPositiveButton("Submit") { _, _ ->
                val rating   = ratingBar.rating.toInt()
                val feedback = etFeedback.text.toString().trim()
                val now      = System.currentTimeMillis()

                // Save rating to Firebase
                rtdb.getReference("ratings").child(donorUid).child(item.id)
                    .setValue(mapOf(
                        "rating"       to rating,
                        "feedback"     to feedback,
                        "reviewerName" to myName,
                        "reviewerUid"  to myUid,
                        "foodName"     to item.foodName,
                        "timestamp"    to now
                    ))

                // Update donor's average rating in user_stats
                rtdb.getReference("ratings").child(donorUid)
                    .addListenerForSingleValueEvent(object : ValueEventListener {
                        override fun onDataChange(snapshot: DataSnapshot) {
                            var total = 0.0
                            var count = 0
                            snapshot.children.forEach { child ->
                                val r = child.child("rating").getValue(Int::class.java) ?: 0
                                total += r; count++
                            }
                            val avg = if (count > 0) total / count else 0.0
                            rtdb.getReference("user_stats").child(donorUid)
                                .updateChildren(mapOf(
                                    "avgRating"    to Math.round(avg * 10.0) / 10.0,
                                    "totalRatings" to count
                                ))
                        }
                        override fun onCancelled(e: DatabaseError) {}
                    })

                // Save to claimer's food history with rating
                rtdb.getReference("food_history").child(myUid).child("claimed").child(item.id)
                    .child("rating").setValue(rating)
                rtdb.getReference("food_history").child(myUid).child("claimed").child(item.id)
                    .child("feedback").setValue(feedback)

                // Clear pending rating flag
                rtdb.getReference("food_items").child(item.id)
                    .child("pendingRatingFor").removeValue()

                Toast.makeText(this, "Thank you for your feedback! ⭐", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Skip", null)
            .show()
    }

    // ── Show reviews for a donor ─────────────────────────────────────────────
    private fun showFeedbackScreen(donorUid: String, donorName: String) {
        val intent = Intent(this, FeedbackActivity::class.java)
        intent.putExtra("donor_uid",  donorUid)
        intent.putExtra("donor_name", donorName)
        startActivity(intent)
    }

    private fun openChat(
        chatId: String, donorUid: String, donorName: String,
        foodName: String, myUid: String, myName: String
    ) {
        val now = System.currentTimeMillis()
        val userChatsRef = rtdb.getReference("user_chats")
        userChatsRef.child(myUid).child(chatId).setValue(
            ChatPreview(chatId, donorUid, donorName, foodName, "", now)
        )
        if (donorUid.isNotEmpty()) {
            userChatsRef.child(donorUid).child(chatId).setValue(
                ChatPreview(chatId, myUid, myName, foodName, "", now)
            )
        }
        val intent = Intent(this, ChatActivity::class.java)
        intent.putExtra("chat_id",       chatId)
        intent.putExtra("other_name",    donorName)
        intent.putExtra("other_user_id", donorUid)
        intent.putExtra("food_name",     foodName)
        startActivity(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        countDownTimer?.cancel()
        foodListener?.let {
            rtdb.getReference("food_items")
                .child(intent.getStringExtra("item_id") ?: "")
                .removeEventListener(it)
        }
    }
}