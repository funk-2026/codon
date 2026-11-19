import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { PrimaryButton } from '@/src/components';
import { useTheme } from '@/src/theme/ThemeProvider';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/** A page that draws every page of a PDF (given as base64) with pdf.js, for Android where WebView cannot show a PDF itself. */
const pdfPage = (b64: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<style>body{margin:0;background:#e9ecef;font-family:sans-serif}#pages canvas{display:block;margin:8px auto;box-shadow:0 1px 4px rgba(0,0,0,.25);max-width:100%;height:auto}
#pos{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;font-size:13px;padding:4px 12px;border-radius:14px}
#err{padding:24px;text-align:center;color:#444}</style></head><body><div id="pages"></div><div id="pos">Loading…</div>
<script src="${PDFJS}/pdf.min.js"></script><script>
pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS}/pdf.worker.min.js';
var data=atob('${b64}');var bytes=new Uint8Array(data.length);for(var i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);
pdfjsLib.getDocument({data:bytes}).promise.then(function(pdf){
 var n=pdf.numPages,box=document.getElementById('pages'),pos=document.getElementById('pos'),cs=[];pos.textContent='Page 1 / '+n;
 var chain=Promise.resolve();
 for(let p=1;p<=n;p++){chain=chain.then(function(){return pdf.getPage(p).then(function(pg){
  var v=pg.getViewport({scale:1}),sc=Math.min(2,(window.innerWidth*(window.devicePixelRatio||1))/v.width),vp=pg.getViewport({scale:sc});
  var c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;box.appendChild(c);cs.push(c);
  return pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;});});}
 window.addEventListener('scroll',function(){var mid=window.scrollY+window.innerHeight/2,cur=1;for(var k=0;k<cs.length;k++){if(cs[k].offsetTop<=mid)cur=k+1;}pos.textContent='Page '+cur+' / '+n;});
 chain.then(function(){window.ReactNativeWebView.postMessage('ready');});
}).catch(function(e){document.getElementById('pos').style.display='none';document.body.innerHTML='<div id="err">This PDF could not be shown.</div>';window.ReactNativeWebView.postMessage('error');});
</script></body></html>`;

/**
 * Shows a PDF in the app with scrolling and zoom. iOS draws it natively; Android downloads it and draws it with pdf.js.
 * Says so plainly when the file cannot be loaded, with a retry.
 */
export function PdfViewer({ url }: { url: string }) {
  const { color, type, space } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [html, setHtml] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const android = Platform.OS === 'android';

  const prepare = useCallback(async () => {
    if (!android) return;
    try {
      const target = `${FileSystem.cacheDirectory}ref-${Date.now()}.pdf`;
      const r = await FileSystem.downloadAsync(url, target);
      if (r.status < 200 || r.status >= 300) throw new Error(String(r.status));
      const b64 = await FileSystem.readAsStringAsync(r.uri, { encoding: FileSystem.EncodingType.Base64 });
      setHtml(pdfPage(b64));
      void FileSystem.deleteAsync(r.uri, { idempotent: true });
    } catch {
      setState('error');
    }
  }, [url, android]);

  useEffect(() => {
    void prepare();
  }, [prepare, attempt]);

  const retry = () => {
    setState('loading');
    setHtml(null);
    setAttempt((a) => a + 1);
  };

  if (state === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.sm }}>
        <Text style={[type['type/h3'], { color: color('text/primary'), textAlign: 'center' }]}>Couldn’t open this document</Text>
        <Text style={[type['type/body-m'], { color: color('text/secondary'), textAlign: 'center' }]}>Check your connection and try again.</Text>
        <PrimaryButton label="Try again" onPress={retry} />
      </View>
    );
  }
  const source = android ? (html ? { html, baseUrl: 'https://localhost' } : null) : { uri: url };
  return (
    <View style={{ flex: 1, backgroundColor: color('bg/sunken') }}>
      {source ? (
        <WebView
          key={attempt}
          source={source}
          originWhitelist={['*']}
          javaScriptEnabled
          scalesPageToFit
          onLoadEnd={() => !android && setState((s) => (s === 'error' ? s : 'ready'))}
          onError={() => setState('error')}
          onHttpError={() => setState('error')}
          onMessage={(e) => {
            if (e.nativeEvent.data === 'ready') setState('ready');
            if (e.nativeEvent.data === 'error') setState('error');
          }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
        />
      ) : null}
      {state === 'loading' ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={color('accent/default')} />
        </View>
      ) : null}
    </View>
  );
}
