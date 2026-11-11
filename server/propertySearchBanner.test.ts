import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import PropertySearchBanner from '../client/src/components/v2/PropertySearchBanner';
describe('recruitment banner',()=>{
 it('provides the agreed wording and both destinations without counts',()=>{const html=renderToStaticMarkup(React.createElement(PropertySearchBanner,{visible:true}));expect(html).toContain('物件をお探しの方がいます');expect(html).toContain('募集中の物件を見る');expect(html).toContain('物件を募集する');expect(html).toContain('href="/v2/property-search"');expect(html).toContain('href="/v2/property-search?new=1"');expect(html).not.toMatch(/\d+件/);});
 it('renders nothing when no active recruitment is available',()=>{expect(renderToStaticMarkup(React.createElement(PropertySearchBanner,{visible:false}))).toBe('');});
});
