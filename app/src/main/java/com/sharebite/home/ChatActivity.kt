package com.sharebite.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.fragments.ChatPreview
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ChatMessage(
    val messageId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val message: String = "",
    val timestamp: Long = 0L
)

class ChatActivity : AppCompatActivity() {

    private lateinit var rvMessages: RecyclerView
    private lateinit var etMessage: EditText
    private val messages = mutableListOf<ChatMessage>()
    private lateinit var adapter: MessagesAdapter
    private val auth = FirebaseAuth.getInstance()

    private val db = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        val chatId      = intent.getStringExtra("chat_id") ?: return
        val otherName   = intent.getStringExtra("other_name") ?: "User"
        val otherUserId = intent.getStringExtra("other_user_id") ?: ""
        val foodName    = intent.getStringExtra("food_name") ?: ""

        val currentUser = auth.currentUser
        val myUid  = currentUser?.uid ?: ""
        val myName = currentUser?.email?.substringBefore("@") ?: "You"

        findViewById<TextView>(R.id.tvChatHeaderName).text = otherName
        findViewById<TextView>(R.id.tvChatHeaderFood).text = "Regarding: $foodName"
        findViewById<TextView>(R.id.btnChatBack).setOnClickListener { finish() }

        rvMessages = findViewById(R.id.rvMessages)
        etMessage  = findViewById(R.id.etMessage)

        adapter = MessagesAdapter(messages, myUid)
        rvMessages.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        rvMessages.adapter = adapter

        // ✅ Same chatId-ல் இரண்டு users-கும் messages தெரியும்
        db.getReference("chats").child(chatId)
            .addValueEventListener(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    messages.clear()
                    for (child in snapshot.children) {
                        val msg = child.getValue(ChatMessage::class.java) ?: continue
                        messages.add(msg)
                    }
                    messages.sortBy { it.timestamp }
                    adapter.notifyDataSetChanged()
                    if (messages.isNotEmpty()) {
                        rvMessages.scrollToPosition(messages.size - 1)
                    }
                }
                override fun onCancelled(error: DatabaseError) {
                    Toast.makeText(this@ChatActivity, "Error loading messages!", Toast.LENGTH_SHORT).show()
                }
            })

        findViewById<Button>(R.id.btnSend).setOnClickListener {
            val text = etMessage.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, "Please type a message!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (myUid.isEmpty()) {
                Toast.makeText(this, "Please login first!", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val chatsRef = db.getReference("chats").child(chatId)
            val msgId = chatsRef.push().key ?: return@setOnClickListener
            val now   = System.currentTimeMillis()

            val msg = ChatMessage(
                messageId  = msgId,
                senderId   = myUid,
                senderName = myName,
                message    = text,
                timestamp  = now
            )

            // ✅ Message save — இரண்டு users-கும் தெரியும்
            chatsRef.child(msgId).setValue(msg)
                .addOnSuccessListener {
                    etMessage.setText("")

                    // My preview update
                    db.getReference("user_chats").child(myUid).child(chatId).setValue(
                        ChatPreview(
                            chatId        = chatId,
                            otherUserId   = otherUserId,
                            otherUserName = otherName,
                            foodName      = foodName,
                            lastMessage   = text,
                            timestamp     = now
                        )
                    )

                    // ✅ Other user preview update
                    if (otherUserId.isNotEmpty()) {
                        db.getReference("user_chats").child(otherUserId).child(chatId).setValue(
                            ChatPreview(
                                chatId        = chatId,
                                otherUserId   = myUid,
                                otherUserName = myName,
                                foodName      = foodName,
                                lastMessage   = text,
                                timestamp     = now
                            )
                        )
                    }
                }
                .addOnFailureListener {
                    Toast.makeText(this, "Failed to send. Try again!", Toast.LENGTH_SHORT).show()
                }
        }
    }
}

class MessagesAdapter(
    private val messages: List<ChatMessage>,
    private val currentUserId: String
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        const val VIEW_TYPE_SENT     = 1
        const val VIEW_TYPE_RECEIVED = 2
    }

    override fun getItemViewType(position: Int): Int {
        return if (messages[position].senderId == currentUserId) VIEW_TYPE_SENT
        else VIEW_TYPE_RECEIVED
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return if (viewType == VIEW_TYPE_SENT) {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_message_sent, parent, false)
            SentViewHolder(view)
        } else {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_message_received, parent, false)
            ReceivedViewHolder(view)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val msg  = messages[position]
        val time = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date(msg.timestamp))
        when (holder) {
            is SentViewHolder -> {
                holder.tvMessage.text = msg.message
                holder.tvTime.text    = time
            }
            is ReceivedViewHolder -> {
                holder.tvMessage.text = msg.message
                holder.tvTime.text    = time
            }
        }
    }

    override fun getItemCount() = messages.size

    class SentViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvMessage: TextView = view.findViewById(R.id.tvSentMessage)
        val tvTime: TextView    = view.findViewById(R.id.tvSentTime)
    }

    class ReceivedViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvMessage: TextView = view.findViewById(R.id.tvReceivedMessage)
        val tvTime: TextView    = view.findViewById(R.id.tvReceivedTime)
    }
}