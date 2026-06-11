package com.sharebite.fragments

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.app.ActivityCompat
import androidx.fragment.app.Fragment
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.android.gms.maps.model.MarkerOptions
import com.sharebite.R

class MapFragment : Fragment(), OnMapReadyCallback {

    private lateinit var googleMap: GoogleMap
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_map, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())

        val mapFragment = childFragmentManager
            .findFragmentById(R.id.mapView) as SupportMapFragment
        mapFragment.getMapAsync(this)
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map

        try {
            googleMap.setMapStyle(
                MapStyleOptions.loadRawResourceStyle(requireContext(), R.raw.map_style_dark)
            )
        } catch (e: Exception) {
            // map_style_dark இல்லன்னா default style use பண்ணு
        }

        googleMap.uiSettings.isZoomControlsEnabled    = true
        googleMap.uiSettings.isMyLocationButtonEnabled = true

        getUserLocationAndPlotPins()
    }

    private fun getUserLocationAndPlotPins() {
        if (ActivityCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 100
            )
            return
        }

        googleMap.isMyLocationEnabled = true

        fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
            val userLat = location?.latitude  ?: 11.0168  // Default: Coimbatore
            val userLng = location?.longitude ?: 76.9558

            val userLatLng = LatLng(userLat, userLng)

            googleMap.animateCamera(
                CameraUpdateFactory.newLatLngZoom(userLatLng, 14f)
            )

            googleMap.addMarker(
                MarkerOptions()
                    .position(userLatLng)
                    .title("You are here")
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_YELLOW))
            )

            // Firebase-லிருந்து load பண்ணிட்டு pins போடு
            FoodDataStore.load(requireContext()) {
                plotFoodItems(userLat, userLng)
            }
        }
    }

    private fun plotFoodItems(userLat: Double, userLng: Double) {
        val now = System.currentTimeMillis()

        FoodDataStore.items.forEach { item ->
            if (item.expiryTimeMillis > 0 && now > item.expiryTimeMillis) return@forEach

            val offsetLat = userLat + (Math.random() - 0.5) * 0.02
            val offsetLng = userLng + (Math.random() - 0.5) * 0.02
            val position  = LatLng(offsetLat, offsetLng)

            val markerColor = if (item.isClaimed)
                BitmapDescriptorFactory.HUE_BLUE
            else
                BitmapDescriptorFactory.HUE_GREEN

            val timeLeft = item.expiryTimeMillis - now
            val hrs  = timeLeft / 3_600_000
            val mins = (timeLeft % 3_600_000) / 60_000
            val timeText = if (hrs > 0) "${hrs}h ${mins}m left" else "${mins}m left"

            googleMap.addMarker(
                MarkerOptions()
                    .position(position)
                    .title(item.foodName)
                    .snippet("By ${item.userName} · $timeText")
                    .icon(BitmapDescriptorFactory.defaultMarker(markerColor))
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        if (requestCode == 100 &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            getUserLocationAndPlotPins()
        }
    }
}