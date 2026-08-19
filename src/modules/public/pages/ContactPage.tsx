import { useState } from "react";
import { z } from "zod";
import {
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import { contactService } from "../services/publicCourseService";

import contacthero from "./contacthero.png";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(2000),
});

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = schema.safeParse(form);

    if (!parsed.success) {
      toast.error(
        parsed.error.errors[0]?.message ??
          "Please check the form."
      );
      return;
    }

    setSubmitting(true);

    try {
      await contactService.submitContactMessage(
        parsed.data as any
      );

      setDone(true);

      toast.success("Message sent successfully!");
    } catch (err: any) {
      toast.error(
        err.message ?? "Could not send message."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white">
      {/* HERO SECTION */}
      <div className="relative h-[260px] sm:h-[320px] md:h-[420px] overflow-hidden">
        <img
          src={contacthero}
          alt="Contact Hero"
          className="w-full h-full object-cover "
        />

        {/* OVERLAY */}
        <div className="absolute inset-0 bg-black/55" />

        {/* CONTENT */}
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="text-center text-white max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight">
              Contact Us
            </h1>

            <p className="mt-3 text-sm sm:text-base md:text-lg text-white/90 leading-relaxed">
              Questions about courses, partnerships,
              or enterprise plans? We'd love to hear
              from you.
            </p>
          </div>
        </div>
      </div>

      {/* CONTACT CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[1fr_340px] gap-8 lg:gap-10">
        {/* FORM */}
        <div>
          <Card className="p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
            {done ? (
              <div className="text-center py-8 sm:py-10">
                <CheckCircle2 className="h-14 w-14 sm:h-16 sm:w-16 text-green-500 mx-auto" />

                <h2 className="mt-4 text-xl sm:text-2xl font-bold text-gray-900">
                  Message Sent
                </h2>

                <p className="text-sm sm:text-base text-gray-500 mt-2">
                  We’ll get back to you within 1
                  business day.
                </p>

                <Button
                  className="mt-6 rounded-xl text-sm sm:text-base"
                  variant="outline"
                  onClick={() => {
                    setDone(false);

                    setForm({
                      name: "",
                      email: "",
                      phone: "",
                      subject: "",
                      message: "",
                    });
                  }}
                >
                  Send Another
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Send a Message
                  </h2>

                  <p className="text-sm sm:text-base text-gray-500 mt-2">
                    Fill out the form and our team
                    will contact you shortly.
                  </p>
                </div>

                <form
                  onSubmit={onSubmit}
                  className="grid sm:grid-cols-2 gap-4 sm:gap-5"
                >
                  {/* NAME */}
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Name
                    </Label>

                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          name: e.target.value,
                        })
                      }
                      required
                      maxLength={100}
                      placeholder="Enter your name"
                      className="h-11 sm:h-12 rounded-xl text-sm sm:text-base"
                    />
                  </div>

                  {/* EMAIL */}
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Email
                    </Label>

                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          email: e.target.value,
                        })
                      }
                      required
                      maxLength={255}
                      placeholder="Enter your email"
                      className="h-11 sm:h-12 rounded-xl text-sm sm:text-base"
                    />
                  </div>

                  {/* PHONE */}
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Phone
                    </Label>

                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phone: e.target.value,
                        })
                      }
                      maxLength={40}
                      placeholder="Enter your phone"
                      className="h-11 sm:h-12 rounded-xl text-sm sm:text-base"
                    />
                  </div>

                  {/* SUBJECT */}
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Subject
                    </Label>

                    <Input
                      value={form.subject}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          subject: e.target.value,
                        })
                      }
                      maxLength={150}
                      placeholder="Enter subject"
                      className="h-11 sm:h-12 rounded-xl text-sm sm:text-base"
                    />
                  </div>

                  {/* MESSAGE */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-sm">
                      Message
                    </Label>

                    <Textarea
                      rows={6}
                      value={form.message}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          message: e.target.value,
                        })
                      }
                      required
                      maxLength={2000}
                      placeholder="Write your message..."
                      className="rounded-2xl resize-none text-sm sm:text-base"
                    />
                  </div>

                  {/* BUTTON */}
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={submitting}
                      className="w-full sm:w-auto rounded-xl h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
                    >
                      {submitting
                        ? "Sending..."
                        : "Send Message"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Card>
        </div>

        {/* CONTACT INFO */}
        <aside className="space-y-4">
          <Card className="p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm flex items-start gap-3">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <Mail className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg">
                Email
              </h3>

              <p className="text-xs sm:text-sm text-gray-500 mt-1 break-all">
                hello@faatpro.com
              </p>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm flex items-start gap-3">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <Phone className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg">
                GSTIN
              </h3>

              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                21CYDPP6938B1ZL
              </p>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 rounded-3xl border border-gray-200 shadow-sm flex items-start gap-3">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <MapPin className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg">
                Office
              </h3>

              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Plot No - 293/3852, MIG - II, SECTOR - 1,Niladri Vihar Road,Near Sani Mandir,Chandrasekharpur,Bhubaneswar, Odisha,751021
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}