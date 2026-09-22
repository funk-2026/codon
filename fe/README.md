# codon

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-qh6nuzcq)

For Dev testing, in the client.ts need to update the IP addr of the system where backend is running by using the follwing command 
```
ip route get 1.1.1.1 | grep -oP 'src \K\S+'
```

For making android and IOS folders 
```
npx expo prebuild --platform android
```

Scripts to install android apks
```
npm run build:android:apk # For Prod apk
npm run build:android:aab # For Prod aab
npm run build:android:debug # For Debug apk
```