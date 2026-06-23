package com.sharebite.home

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.fragments.ChatPreview
import com.sharebite.fragments.FoodDataStore
import com.sharebite.fragments.FoodItem
import java.io.File

class FoodDetailActivity : AppCompatActivity() {

    private var countDownTimer: CountDownTimer? = null
    private var isUIInitialized = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_food_detail)

        val itemId = intent.getStringExtra("item_id") ?: return

        val foodDb = FirebaseDatabase
            .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
            .getReference("food_items")

        val chatDb = FirebaseDatabase
            .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
            .getReference("user_chats")

        val currentUser = FirebaseAuth.getInstance().currentUser
        val myUid  = currentUser?.uid ?: ""
        val myName = currentUser?.displayName
            ?: currentUser?.email?.substringBefore("@") ?: "You"

        val btnClaim       = findViewById<Button>(R.id.btnClaimFood)
        val layoutClaimed  = findViewById<LinearLayout>(R.id.layoutClaimed)
        val viewDimOverlay = findViewById<View>(R.id.viewDimOverlay)

        foodDb.child(itemId).addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val item = snapshot.getValue(FoodItem::class.java)
                if (item == null) {
                    Toast.makeText(this@FoodDetailActivity, "Item not found!", Toast.LENGTH_SHORT).show()
                    finish()
                    return
                }

                // ✅ Real-time claimed state — எப்போவும் update
                if (item.isClaimed) {
                    layoutClaimed.visibility  = View.VISIBLE
                    viewDimOverlay.visibility = View.VISIBLE
                    btnClaim.isEnabled        = false
                    btnClaim.text             = "Already Claimed"
                    btnClaim.alpha            = 0.5f
                } else {
                    layoutClaimed.visibility  = View.GONE
                    viewDimOverlay.visibility = View.GONE
                    btnClaim.isEnabled        = true
                    btnClaim.text             = "Claim Food"
                    btnClaim.alpha            = 1.0f
                }

                // First load மட்டும் full UI setup
                if (!isUIInitialized) {
                    isUIInitialized = true
                    setupUI(item, myUid, myName, chatDb, foodDb)
                }
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(this@FoodDetailActivity, "Error loading item!", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun setupUI(
        item: FoodItem,
        myUid: String,
        myName: String,
        chatDb: com.google.firebase.database.DatabaseReference,
        foodDb: com.google.firebase.database.DatabaseReference
    ) {
        val tvFoodName     = findViewById<TextView>(R.id.tvDetailFoodName)
        val tvCategory     = findViewById<TextView>(R.id.tvDetailCategory)
        val tvQuantity     = findViewById<TextView>(R.id.tvDetailQuantity)
        val tvLocation     = findViewById<TextView>(R.id.tvDetailLocation)
        val tvPickup       = findViewById<TextView>(R.id.tvDetailPickup)
        val tvDesc         = findViewById<TextView>(R.id.tvDetailDesc)
        val tvDonorName    = findViewById<TextView>(R.id.tvDonorName)
        val tvDonorAvatar  = findViewById<TextView>(R.id.tvDonorAvatar)
        val tvCountdown    = findViewById<TextView>(R.id.tvCountdown)
        val btnBack        = findViewById<TextView>(R.id.btnBack)
        val btnClaim       = findViewById<Button>(R.id.btnClaimFood)
        val btnMessage     = findViewById<Button>(R.id.btnMessageDonor)
        val imgDetail      = findViewById<ImageView>(R.id.imgDetail)

        btnBack.setOnClickListener { finish() }

        tvFoodName.text    = item.foodName
        tvCategory.text    = item.category
        tvQuantity.text    = item.quantity
        tvLocation.text    = item.location.ifEmpty { "Location not specified" }
        tvPickup.text      = "Now · ${item.location.ifEmpty { "Nearby" }}"
        tvDesc.text        = item.description.ifEmpty { "No description" }
        tvDonorName.text   = item.userName
        tvDonorAvatar.text = item.userName.firstOrNull()?.uppercase() ?: "U"

        // Image load
        if (!item.imageUri.isNullOrEmpty()) {
            try {
                val imageSource: Any = when {
                    item.imageUri.startsWith("/")    -> File(item.imageUri)
                    item.imageUri.startsWith("http") -> item.imageUri
                    else -> item.imageUri
                }
                com.bumptech.glide.Glide.with(this)
                    .load(imageSource)
                    .centerCrop()
                    .placeholder(android.R.drawable.ic_menu_gallery)
                    .error(android.R.drawable.ic_menu_gallery)
                    .into(imgDetail)
                imgDetail.visibility = View.VISIBLE
            } catch (e: Exception) {
                imgDetail.visibility = View.GONE
            }
        } else {
            imgDetail.visibility = View.GONE
        }

        // Countdown timer
        countDownTimer?.cancel()
        val remaining = item.expiryTimeMillis - System.currentTimeMillis()
        if (remaining > 0) {
            countDownTimer = object : CountDownTimer(remaining, 1000) {
                override fun onTick(millisUntilFinished: Long) {
                    val hrs  = millisUntilFinished / 3_600_000
                    val mins = (millisUntilFinished % 3_600_000) / 60_000
                    val secs = (millisUntilFinished % 60_000) / 1000
                    tvCountdown.text = String.format("%02d : %02d : %02d", hrs, mins, secs)
                }
                override fun onFinish() {
                    tvCountdown.text   = "Expired!"
                    btnClaim.isEnabled = false
                    btnClaim.alpha     = 0.5f
                    btnClaim.text      = "Expired"
                }
            }.start()
        } else {
            tvCountdown.text   = "Expired!"
            btnClaim.isEnabled = false
            btnClaim.alpha     = 0.5f
            btnClaim.text      = "Expired"
        }

        val donorUid = item.userUid
        // ✅ Unified chatId format: sorted uids like web
        val chatId = if (myUid < donorUid) "${myUid}_$donorUid" else "${donorUid}_$myUid"

        btnMessage.setOnClickListener {
            if (myUid.isEmpty()) {
                Toast.makeText(this, "Please login first!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            openChat(chatId, donorUid, item.userName, item.foodName, myUid, myName, chatDb)
        }

        // ✅ Claim button — Firebase-ல் check பண்ணி ஒரே ஒரு தடவை claim
        btnClaim.setOnClickListener {
            btnClaim.isEnabled = false
            btnClaim.text      = "Claiming..."

            // Firebase-ல் latest isClaimed check பண்ணு
            foodDb.child(item.id).child("isClaimed").get().addOnSuccessListener { snapshot ->
                val alreadyClaimed = snapshot.getValue(Boolean::class.java) ?: false

                if (alreadyClaimed) {
                    // வேற யாரோ claim பண்ணிட்டாங்க
                    Toast.makeText(this, "Already claimed by someone else!", Toast.LENGTH_SHORT).show()
                    btnClaim.text  = "Already Claimed"
                    btnClaim.alpha = 0.5f
                    return@addOnSuccessListener
                }

                // ✅ Claim பண்ணு
                foodDb.child(item.id).child("isClaimed").setValue(true)
                foodDb.child(item.id).child("claimedByUid").setValue(myUid)
                FoodDataStore.updateClaimed(item.id)

                Toast.makeText(this, "Food Claimed! Enjoy your meal! 🎉", Toast.LENGTH_SHORT).show()

                if (myUid.isNotEmpty()) {
                    val chatsDb = FirebaseDatabase
                        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
                        .getReference("chats")

                    val msgId = chatsDb.child(chatId).push().key ?: ""
                    if (msgId.isNotEmpty()) {
                        val autoMsg = ChatMessage(
                            messageId  = msgId,
                            senderId   = myUid,
                            senderName = myName,
                            message    = "Hi! I claimed your food '${item.foodName}'. Thank you! 🙏",
                            timestamp  = System.currentTimeMillis()
                        )
                        chatsDb.child(chatId).child(msgId).setValue(autoMsg)
                    }

                    openChat(
                        chatId, donorUid, item.userName, item.foodName,
                        myUid, myName, chatDb,
                        firstMessage = "Hi! I claimed your food '${item.foodName}'. Thank you! 🙏"
                    )
                }
            }.addOnFailureListener {
                Toast.makeText(this, "Network error. Try again!", Toast.LENGTH_SHORT).show()
                btnClaim.isEnabled = true
                btnClaim.text      = "Claim Food"
            }
        }
    }

    private fun openChat(
        chatId: String,
        donorUid: String,
        donorName: String,
        foodName: String,
        myUid: String,
        myName: String,
        chatDb: com.google.firebase.database.DatabaseReference,
        firstMessage: String = ""
    ) {
        val now = System.currentTimeMillis()

        chatDb.child(myUid).child(chatId).setValue(
            ChatPreview(
                chatId        = chatId,
                otherUserId   = donorUid,
                otherUserName = donorName,
                foodName      = foodName,
                lastMessage   = firstMessage,
                timestamp     = now
            )
        )

        if (donorUid.isNotEmpty()) {
            chatDb.child(donorUid).child(chatId).setValue(
                ChatPreview(
                    chatId        = chatId,
                    otherUserId   = myUid,
                    otherUserName = myName,
                    foodName      = foodName,
                    lastMessage   = firstMessage,
                    timestamp     = now
                )
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
    }
}