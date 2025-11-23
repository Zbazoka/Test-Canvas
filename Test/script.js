// script.js — static React + React Flow app using esm.sh CDN
import React from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
import ReactFlow, { ReactFlowProvider, addEdge, Background, Controls, MiniMap, Handle, Position } from 'https://esm.sh/react-flow-renderer@11.6.11';

const { useState, useCallback, useRef, useEffect } = React;

function CustomNode({ data, id }){
  const onPromptChange = (e) => data.onChangePrompt(id, e.target.value);
  const onRun = async () => data.onRun(id);
  const selectOption = async (opt, idx) => data.onSelectOption(id, opt, idx);

  return React.createElement('div',{className:'rf-node custom-node'},
    React.createElement('div',{className:'node-title'},
      React.createElement('div',{className:'dot'}),
      React.createElement('h3',null, data.label)
    ),
    React.createElement('textarea',{value:data.prompt||'', onChange:onPromptChange, placeholder:'Enter prompt...'}),
    React.createElement('div',{className:'btn-row'},
      React.createElement('button',{onClick:onRun}, data.loading? 'Running...':'Run'),
      React.createElement('button',{onClick:()=>data.clear(id)}, 'Clear')
    ),
    data.options && data.options.length>0 && React.createElement('div',{className:'options'},
      data.options.map((op,idx)=>(
        React.createElement('button',{key:idx, className:'option-btn '+(data.selectedIdx===idx?'selected':''), onClick:()=>selectOption(op, idx)}, op.length>120?op.slice(0,120)+'...':op)
      ))
    ),
    data.result && React.createElement('div',{className:'result'}, data.result),
    React.createElement(Handle, { type: 'target', position: Position.Top }),
    React.createElement(Handle, { type: 'source', position: Position.Bottom })
  );
}

function CanvasApp(){
  const [nodes, setNodes] = useState([
    {
      id: '1',
      type: 'custom',
      position: { x: 50, y: 50 },
      data: createNodeData('Node 1', 'viết cho tôi các kịch bản hài hước giữa 1 chú chó và 1 cậu bé')
    }
  ]);
  const [edges, setEdges] = useState([]);
  const idRef = useRef(2);

  useEffect(()=>{
    const saved = localStorage.getItem('ai-canvas-nodes');
    if(saved){
      try{
        const parsed = JSON.parse(saved);
        if(parsed.nodes) setNodes(parsed.nodes);
        if(parsed.edges) setEdges(parsed.edges);
      }catch(e){}
    }
  },[]);

  useEffect(()=>{
    document.getElementById('saveKey').onclick = ()=>{
      const k = document.getElementById('apiKey').value.trim();
      if(!k){ alert('Please paste your OpenAI key'); return; }
      localStorage.setItem('OPENAI_KEY', k);
      const s = document.getElementById('status'); if(s) s.textContent = 'API key saved (localStorage)';
    };
    document.getElementById('addNode').onclick = addNode;
    document.getElementById('exportJson').onclick = exportJson;
  },[]);

  function createNodeData(label, prompt){
    return {
      label,
      prompt,
      options: null,
      result: null,
      loading: false,
      selectedIdx: null,
      onChangePrompt: (id, v)=>{
        setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, prompt:v}}):nd));
      },
      onRun: async (id)=>{
        const key = localStorage.getItem('OPENAI_KEY');
        if(!key){ alert('Please save API key first'); return; }
        setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, loading:true}}):nd));
        try{
          const nd = nodes.find(x=>x.id===id);
          const prompt = nd.data.prompt;
          const body = {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: `Generate 4 distinct short options labelled A,B,C,D for this instruction: ${prompt}` }],
            max_tokens: 400,
            temperature: 0.9
          };
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method:'POST', headers:{
              'Content-Type':'application/json',
              'Authorization': 'Bearer '+key
            }, body: JSON.stringify(body)
          });
          const j = await res.json();
          const text = j.choices?.[0]?.message?.content || '';
          const opts = parseOptions(text);
          setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, options:opts, loading:false}}):nd));
          const s = document.getElementById('status'); if(s) s.textContent = 'Options received';
        }catch(err){
          console.error(err);
          setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, loading:false}}):nd));
          const s = document.getElementById('status'); if(s) s.textContent = 'Error calling OpenAI';
        }
      },
      onSelectOption: async (id, opt, idx)=>{
        const key = localStorage.getItem('OPENAI_KEY');
        if(!key){ alert('Please save API key first'); return; }
        setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, loading:true}}):nd));
        try{
          const body = {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: `Write a full detailed script ONLY for this option: ${opt}` }],
            max_tokens: 800,
            temperature: 0.8
          };
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method:'POST', headers:{
              'Content-Type':'application/json',
              'Authorization': 'Bearer '+key
            }, body: JSON.stringify(body)
          });
          const j = await res.json();
          const text = j.choices?.[0]?.message?.content || '';
          setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, result:text, loading:false, selectedIdx:idx}}):nd));
          const s = document.getElementById('status'); if(s) s.textContent = 'Full content ready';
        }catch(err){
          console.error(err);
          setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, loading:false}}):nd));
          const s = document.getElementById('status'); if(s) s.textContent = 'Error generating full content';
        }
      },
      clear: (id)=>{
        setNodes(n=>n.map(nd=>nd.id===id?({...nd, data:{...nd.data, options:null, result:null}}):nd));
      }
    };
  }

  function parseOptions(text){
    if(!text) return [];
    const lines = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const out = [];
    for(const ln of lines){
      const m = ln.match(/^[A-D][\)\.\:-]\s*(.*)/i);
      if(m) out.push(m[1]);
    }
    if(out.length===0){
      const sentences = text.match(/[^\.!?]+[\.!?]?/g) || [text];
      return sentences.slice(0,4).map(s=>s.trim());
    }
    return out.slice(0,4);
  }

  const addNode = useCallback(()=>{
    const id = String(idRef.current++);
    const newNode = {
      id,
      type:'custom',
      position:{ x: 120 + (idRef.current-2)*20, y: 120 + (idRef.current-2)*10 },
      data: createNodeData('Node '+id,'')
    };
    setNodes(nds=>[...nds, newNode]);
  }, []);

  function exportJson(){
    const payload = { nodes, edges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'workflow.json'; a.click();
  }

  const onConnect = useCallback((params)=> setEdges(es=>addEdge(params, es)), []);

  return React.createElement(ReactFlowProvider, null,
    React.createElement(ReactFlow, {
      nodes: nodes.map(n=>({...n, type:'custom', data:n.data})),
      edges,
      onConnect,
      fitView: true,
      nodeTypes: { custom: CustomNode }
    },
      React.createElement(Background, null),
      React.createElement(Controls, null),
      React.createElement(MiniMap, null)
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(CanvasApp));
