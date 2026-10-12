import React, {useEffect,useState} from 'react';
import NativeAIControls from './NativeAIControls';
import NativeAIReport from './NativeAIReport';
import useNativeAIRequest from './useNativeAIRequest';
import './NativeRuntimeAI.css';

export default function NativeRuntimeAI({config,request}) {
  const [fields,setFields]=useState({}),[result,setResult]=useState(null),[error,setError]=useState('');
  const [history,setHistory]=useState([]),[historyError,setHistoryError]=useState(''),[selected,setSelected]=useState(null);
  const native=useNativeAIRequest();
  const loadHistory=()=>request(`${config.endpoint}/history`,null,{method:'get'}).then(payload=>{
    const items=Array.isArray(payload)?payload:payload?.data;
    if(!Array.isArray(items))throw new Error('Saved reviews response did not contain a record list.');
    setHistory(items);setHistoryError('');
  }).catch(failure=>setHistoryError(failure.response?.data?.error||failure.message));
  useEffect(()=>{loadHistory();},[config.endpoint,request]);
  const presets=[0,1,2].map(index=>({name:['Quick brief','Team planning','Detailed review'][index],fill:()=>{setFields(Object.fromEntries(config.fields.map(field=>[field.key,field.examples[index]])));return {filled:config.fields.length,manual:[]};}}));
  async function generate(event){event.preventDefault();setError('');setResult(null);setSelected(null);try{const body=Object.fromEntries(config.fields.map(field=>[field.key,fields[field.key]||'']));const response=await native.run(signal=>request(config.endpoint,body,{signal}));setResult(response);loadHistory();}catch(failure){setError(failure.name==='AbortError'?'Request canceled.':failure.response?.data?.error||failure.message);}}
  return <section className="native-runtime-ai" id="ai-readiness"><header><p className="ai-eyebrow">Native AI workspace</p><h1>{config.title}</h1><p>{config.description}</p></header><NativeAIControls busy={native.busy} onCancel={native.cancel} presets={presets} context={config.title}><form onSubmit={generate}><div className="native-runtime-fields">{config.fields.map(field=><label key={field.key} htmlFor={'native-runtime-'+field.key}>{field.label}{field.required?' *':' (optional)'}<textarea id={'native-runtime-'+field.key} data-ai-field={field.key} rows={5} required={field.required} maxLength={field.maxLength||4000} value={fields[field.key]||''} onChange={event=>setFields({...fields,[field.key]:event.target.value})}/></label>)}</div><button type="submit" className="native-runtime-generate" disabled={native.busy}>{native.busy?'Generating…':'Generate with OpenRouter'}</button>{error&&<p role="alert">{error}</p>}</form></NativeAIControls>{(selected||result)&&<NativeAIReport response={selected||result} title={selected?'Saved review':config.title}/>}<section className="ai-history"><h2>Saved reviews</h2>{historyError&&<p role="alert">{historyError}</p>}{history.length ? history.map(item=><button className="ai-history-row" type="button" key={item.id} onClick={()=>setSelected(item)}><span>{String(item.prompt||'').slice(0,100)}</span><time>{new Date(item.createdAt).toLocaleString()}</time></button>) : !historyError&&<p>No saved reviews yet.</p>}</section></section>;
}
