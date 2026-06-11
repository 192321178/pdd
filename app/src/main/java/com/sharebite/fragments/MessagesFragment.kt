package com.sharebite.fragments

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.sharebite.R
import com.sharebite.home.ChatActivity

data class ChatPreview(
    val chatId: String = "",
    val otherUserId: String = "",
    val otherUserName: String = "",
    val foodName: String = "",
    val lastMessage: String = "",
    val timestamp: Long = 0L
)

class MessagesFragment : Fragment() {

    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseDatabase
        .getInstance("https://sharebite-7143d-default-rtdb.firebaseio.com")
        .getReference("user_chats")

    private val chatList = mutableListOf<ChatPreview>()
    private lateinit var adapter: ChatListAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_messages, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val rvChats = view.findViewById<RecyclerView>(R.id.rvChats)
        adapter = ChatListAdapter(chatList) { chat ->
            val intent = Intent(requireContext(), ChatActivity::class.java)
            intent.putExtra("chat_id",    chat.chatId)
            intent.putExtra("other_name", chat.otherUserName)
            intent.putExtra("food_name",  chat.foodName)
            startActivity(intent)
        }
        rvChats.layoutManager = LinearLayoutManager(requireContext())
        rvChats.adapter = adapter

        loadChats()
    }

    override fun onResume() {
        super.onResume()
        // Messages page திறந்தா last seen update பண்ணு → bell badge clear ஆகும்
        val prefs = requireContext().getSharedPreferences("sharebite_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().putLong("messages_last_seen", System.currentTimeMillis()).apply()
    }

    private fun loadChats() {
        val uid = auth.currentUser?.uid ?: return
        db.child(uid).addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                chatList.clear()
                for (child in snapshot.children) {
                    val chat = child.getValue(ChatPreview::class.java) ?: continue
                    chatList.add(chat)
                }
                chatList.sortByDescending { it.timestamp }
                adapter.notifyDataSetChanged()
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }
}

class ChatListAdapter(
    private val chats: List<ChatPreview>,
    private val onClick: (ChatPreview) -> Unit
) : RecyclerView.Adapter<ChatListAdapter.ChatViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat, parent, false)
        return ChatViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatViewHolder, position: Int) {
        val chat = chats[position]
        holder.tvAvatar.text      = chat.otherUserName.firstOrNull()?.uppercase() ?: "U"
        holder.tvName.text        = chat.otherUserName
        holder.tvFoodName.text    = "Regarding: ${chat.foodName}"
        holder.tvLastMessage.text = chat.lastMessage.ifEmpty { "Start a conversation" }
        holder.tvTime.text        = if (chat.timestamp > 0) {
            java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault())
                .format(java.util.Date(chat.timestamp))
        } else ""
        holder.itemView.setOnClickListener { onClick(chat) }
    }

    override fun getItemCount() = chats.size

    class ChatViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvAvatar:      TextView = view.findViewById(R.id.tvChatAvatar)
        val tvName:        TextView = view.findViewById(R.id.tvChatName)
        val tvFoodName:    TextView = view.findViewById(R.id.tvChatFoodName)
        val tvLastMessage: TextView = view.findViewById(R.id.tvLastMessage)
        val tvTime:        TextView = view.findViewById(R.id.tvChatTime)
    }
}