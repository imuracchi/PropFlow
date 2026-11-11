import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({data:vi.fn(),claim:vi.fn(),complete:vi.fn(),send:vi.fn()}));
vi.mock('../db',()=>({getPropertySearchPublicationData:mocks.data,claimPropertySearchPublication:mocks.claim,completePropertySearchPublication:mocks.complete}));
vi.mock('./mail',()=>({sendMail:mocks.send}));
import {sendPropertySearchPublication} from './propertySearchPublication';
const request={id:123,title:'<希望条件>',areas:['東京'],propertyTypes:['土地'],minPrice:null,maxPrice:100000000,minArea:100,maxArea:null,purchaseTiming:'半年以内',userId:999,anonymous:1};
beforeEach(()=>{vi.clearAllMocks();mocks.data.mockResolvedValue({requests:[request],recipients:[{email:'one@example.com'},{email:'two@example.com'}]});mocks.claim.mockResolvedValue(true);mocks.send.mockResolvedValue(true);});
describe('publication mail',()=>{
 it('sends published conditions without identifying anonymous requester',async()=>{await sendPropertySearchPublication(123);expect(mocks.send).toHaveBeenCalledTimes(2);const [to,subject,html]=mocks.send.mock.calls[0];expect(to).toBe('one@example.com');expect(subject).toContain('物件募集');expect(html).toContain('&lt;希望条件&gt;');expect(html).toContain('/v2/property-search');expect(html).not.toContain('999');expect(html).not.toContain('昨日');expect(mocks.complete).toHaveBeenCalledWith(123,2,'sent');});
 it('does not send draft, hidden, closed or expired requests excluded by lookup',async()=>{mocks.data.mockResolvedValue({requests:[],recipients:[{email:'one@example.com'}]});await sendPropertySearchPublication(123);expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();});
 it('does not send when no opted-in eligible recipients exist',async()=>{mocks.data.mockResolvedValue({requests:[request],recipients:[]});await sendPropertySearchPublication(123);expect(mocks.send).not.toHaveBeenCalled();});
 it('does not resend an already claimed publication',async()=>{mocks.claim.mockResolvedValue(false);expect(await sendPropertySearchPublication(123)).toMatchObject({duplicate:true});expect(mocks.send).not.toHaveBeenCalled();});
 it('sends once under concurrent publication events',async()=>{let claimed=false;mocks.claim.mockImplementation(async()=>{if(claimed)return false;claimed=true;return true;});await Promise.all([sendPropertySearchPublication(123),sendPropertySearchPublication(123)]);expect(mocks.send).toHaveBeenCalledTimes(2);expect(mocks.complete).toHaveBeenCalledTimes(1);});
 it('records partial failure without preventing remaining recipients',async()=>{mocks.send.mockRejectedValueOnce(new Error('provider failure')).mockResolvedValueOnce(true);await sendPropertySearchPublication(123);expect(mocks.send).toHaveBeenCalledTimes(2);expect(mocks.complete).toHaveBeenCalledWith(123,1,'error');});
});
