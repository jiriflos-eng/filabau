import test from "node:test";
import assert from "node:assert/strict";
import {bookingCalendarSettings,bookingCalendarWindows,bookingWindowAllows,bookingToday} from "./calendar-range.js";
const settings=bookingCalendarSettings({seasonStart:"04-30",seasonEnd:"10-31",hidePastDays:true,seasonsToShow:2});
test("season windows and boundary dates",()=>{
  assert.deepEqual(bookingCalendarWindows(settings,"2026-11-26"),[{year:2027,from:"2027-04-30",to:"2027-10-31"},{year:2028,from:"2028-04-30",to:"2028-10-31"}]);
  assert.equal(bookingCalendarWindows(settings,"2027-07-10")[0].from,"2027-07-10");
  assert.deepEqual(bookingCalendarWindows(settings,"2027-10-31")[0],{year:2027,from:"2027-10-31",to:"2027-10-31"});
  assert.ok(!bookingWindowAllows(bookingCalendarWindows(settings,"2027-10-31"),"2027-10-31","2027-11-01","2027-10-31"));
  const windows=bookingCalendarWindows(settings,"2026-11-26");
  assert.ok(bookingWindowAllows(windows,"2027-04-30","2027-10-31","2026-11-26"));
  assert.ok(!bookingWindowAllows(windows,"2027-04-29","2027-05-05","2026-11-26"));
  assert.ok(!bookingWindowAllows(windows,"2027-10-30","2027-11-01","2026-11-26"));
  assert.ok(!bookingWindowAllows(windows,"2029-05-01","2029-05-06","2026-11-26"));
  assert.throws(()=>bookingCalendarSettings({seasonStart:"02-30",seasonEnd:"10-31"}));
  assert.throws(()=>bookingCalendarSettings({seasonStart:"10-31",seasonEnd:"04-30"}));
  assert.equal(bookingToday(new Date("2027-06-01T21:15:00Z")),"2027-06-02");
});
