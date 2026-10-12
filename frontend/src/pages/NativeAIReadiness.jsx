import React from 'react';
import NativeRuntimeAI from '../components/NativeRuntimeAI';
import api from '../api/axios';
const request=(endpoint,body,options)=>options?.method==='get'?api.get(endpoint).then(r=>r.data):api.post(endpoint,body,options).then(r=>r.data);
const config={
  "title": "Integration operations review",
  "description": "Native OpenRouter advisory review of supplied information. Examples are illustrative; existing records, evidence, approvals, permissions and operational controls remain authoritative. This response performs no external action.",
  "endpoint": "/runtime-ai/integration-advice",
  "fields": [
    {
      "key": "prompt",
      "label": "Review brief",
      "required": true,
      "maxLength": 4000,
      "examples": [
        "Illustrative Integration operations review brief: review supplied source information, identify evidence gaps, and suggest three next steps for an authorized reviewer. No external action is authorized.",
        "Illustrative Integration operations review team review: compare options, dependencies, responsible reviewers, and timing. Explain missing evidence and approvals before any operational change.",
        "Illustrative Integration operations review detailed review: distinguish verified facts from assumptions, compare tradeoffs, and suggest measurable follow-up actions. Do not invent records, integrations, approvals, clinical findings or financial execution."
      ]
    }
  ]
};
export default function NativeAIReadiness(){return <NativeRuntimeAI config={config} request={request}/>;}
