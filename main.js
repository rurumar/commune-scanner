"use strict";
      window.onload = async () => {
            let map = L.map("map", {
            center: [48.856667, 2.352222],
            zoom: 11,
        });

        let layer = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 15,
            attribution:
              '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }
        );
        layer.addTo(map);
      }