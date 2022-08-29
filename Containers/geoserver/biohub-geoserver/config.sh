# Geoserver needs a bit of time to get ready
# sleep 120

# Change the admin account password
# curl -X PUT \
#   --header 'Content-Type: application/json' \
#   -d "{\"newPassword\": \"$ADMIN_PASS\"}" \
#   -L "http://admin:geoserver@localhost:8080/geoserver/rest/security/self/password"

# # Geoserver needs a bit to register the new password
# sleep 5

# # Create a new workspace called invasives
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "{\"workspace\":{ \"name\":\"invasives\" }}" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces"

# # Make invasives the default workspace
# curl -X PUT \
#   --header 'Content-Type: application/json' \
#   -d "{\"workspace\":{ \"name\":\"invasives\" }}" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/default"

# # Create BCGW data store
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-bcgw-store.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores"

# # To connect to the database we have to load the credentials from 
# # environment variables into the json
# sed -i s/fake_server/$DB_HOST/ json/create-invasives-store.json 
# sed -i s/fake_port/$DB_PORT/ json/create-invasives-store.json 
# sed -i s/fake_database/$DB_DATABASE/ json/create-invasives-store.json 
# sed -i s/fake_user/$DB_USER/ json/create-invasives-store.json 
# sed -i s/fake_password/$DB_PASSWORD/ json/create-invasives-store.json 

# # Create Invasives data store
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-invasives-store.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/datastores"

# ############# BCGW WMS Proxy Layers #############
# # Create NRD Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-nrd-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Well Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-well-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Streams Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-stream-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Wetland Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-wetland-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Ownership Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-ownership-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Municipalities Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-municipalities-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Regional Districts Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-regional-districts-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Road Feature Inventory Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-rfi-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create BEC Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-bec-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create MOTI Region Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-moti-region-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create MOTI District Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-moti-district-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create OGMA Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-ogma-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create WHA Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-wha-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Fisheries Sensitive Watershed Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-fsw-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create First Nation Reserve Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-fnr-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create Ungulate Winter Range Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-uwr-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"

# # Create National Park Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-national-park-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/wmsstores/BCGW/wmslayers/"
# #################################################


# ############# Invasives WMS Layers #############
# # Create RISO Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-riso-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/datastores/Invasives/featuretypes/"

# # Create IPMA Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-ipma-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/datastores/Invasives/featuretypes/"

# # Create Aggregate Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-aggregate-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/datastores/Invasives/featuretypes/"

# # Create Jurisdiction Layer
# curl -X POST \
#   --header 'Content-Type: application/json' \
#   -d "@json/create-jurisdiction-layer.json" \
#   -L "http://admin:$ADMIN_PASS@localhost:8080/geoserver/rest/workspaces/invasives/datastores/Invasives/featuretypes/"
# ################################################

# Signal that we are ready.
touch data_dir/www/success
